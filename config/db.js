const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Determine database type
// If process.env.DB_TYPE is 'sqlite' or if we default to SQLite on Render when DB credentials are empty
const useSqlite = process.env.DB_TYPE === 'sqlite' || 
                  (!process.env.DB_USER && !process.env.DB_HOST) || 
                  (process.env.DB_HOST === 'localhost' && !process.env.DB_PASSWORD && process.env.RENDER === 'true') ||
                  process.env.RENDER === 'true'; // Force SQLite on Render to avoid MySQL database dependency

let pool;
let sqliteDb;

// Helper to translate MySQL queries to SQLite
function translateQuery(sql) {
  if (!useSqlite) return sql;
  
  let translated = sql;
  // Translate MONTH(created_at) -> CAST(strftime('%m', created_at) AS INTEGER)
  translated = translated.replace(/MONTH\((.*?)\)/gi, "CAST(strftime('%m', $1) AS INTEGER)");
  // Translate YEAR(created_at) -> CAST(strftime('%Y', created_at) AS INTEGER)
  translated = translated.replace(/YEAR\((.*?)\)/gi, "CAST(strftime('%Y', $1) AS INTEGER)");
  // Translate DATE(c.created_at) -> date(c.created_at)
  translated = translated.replace(/DATE\((.*?)\)/gi, "date($1)");
  
  return translated;
}

async function initDB() {
  if (useSqlite) {
    console.log('Using SQLite Database for deployment/fallback...');
    const sqlite3 = require('sqlite3').verbose();
    const path = require('path');
    const dbPath = path.join(__dirname, '../database.sqlite');
    
    sqliteDb = new sqlite3.Database(dbPath);
    
    // Enable Foreign Keys in SQLite
    await new Promise((resolve, reject) => {
      sqliteDb.run('PRAGMA foreign_keys = ON', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    await createSqliteTables();
    await seedSqliteDatabase();
    console.log('SQLite Database initialized and seeded successfully.');
  } else {
    try {
      const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
      };
      
      const connection = await mysql.createConnection(dbConfig);
      const dbName = process.env.DB_NAME || 'citizen_grievance_db';
      
      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
      await connection.end();

      pool = mysql.createPool({
        ...dbConfig,
        database: dbName,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
      });

      console.log(`Database connected: ${dbName}`);
      await createTables();
      await seedDatabase();
    } catch (error) {
      console.warn('MySQL initialization failed, falling back to SQLite...', error.message);
      // Force sqlite fallback
      process.env.DB_TYPE = 'sqlite';
      return initDB();
    }
  }
}

async function createSqliteTables() {
  const run = (sql) => new Promise((res, rej) => sqliteDb.run(sql, (err) => err ? rej(err) : res()));

  await run(`
    CREATE TABLE IF NOT EXISTS citizens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      mobile TEXT NOT NULL,
      address TEXT NOT NULL,
      aadhaar TEXT NULL,
      password TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      department_name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id TEXT UNIQUE NOT NULL,
      citizen_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      department TEXT NOT NULL,
      location TEXT NOT NULL,
      priority TEXT DEFAULT 'Medium',
      document_path TEXT NULL,
      status TEXT DEFAULT 'Submitted',
      remarks TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (citizen_id) REFERENCES citizens(id) ON DELETE CASCADE
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS complaint_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id TEXT NOT NULL,
      old_status TEXT NOT NULL,
      new_status TEXT NOT NULL,
      remarks TEXT NULL,
      updated_by TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id) ON DELETE CASCADE
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      is_read BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES citizens(id) ON DELETE CASCADE
    );
  `);
}

async function seedSqliteDatabase() {
  const query = (sql, params) => new Promise((res, rej) => sqliteDb.all(sql, params, (err, rows) => err ? rej(err) : res(rows)));
  const run = (sql, params) => new Promise((res, rej) => sqliteDb.run(sql, params, (err) => err ? rej(err) : res()));

  // Seed Default Super Admin
  const admins = await query('SELECT * FROM admins WHERE username = ?', ['admin']);
  if (admins.length === 0) {
    const adminPasswordHash = bcrypt.hashSync('Admin@123', 10);
    await run(
      'INSERT INTO admins (username, name, email, password, role) VALUES (?, ?, ?, ?, ?)',
      ['admin', 'Super Admin', 'admin@grievanceportal.gov', adminPasswordHash, 'superadmin']
    );
    console.log('Default Super Admin seeded in SQLite.');
  }

  // Seed Default Departments
  const defaultDepts = [
    'Roads', 'Water Supply', 'Electricity', 'Health', 'Education', 'Transport', 'Public Safety', 'Sanitation'
  ];

  for (const dept of defaultDepts) {
    const existing = await query('SELECT * FROM departments WHERE department_name = ?', [dept]);
    if (existing.length === 0) {
      await run('INSERT INTO departments (department_name) VALUES (?)', [dept]);
    }
  }
}

// MySQL Tables
async function createTables() {
  const citizensTable = `
    CREATE TABLE IF NOT EXISTS citizens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      mobile VARCHAR(15) NOT NULL,
      address TEXT NOT NULL,
      aadhaar VARCHAR(12) NULL,
      password VARCHAR(255) NOT NULL,
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `;

  const adminsTable = `
    CREATE TABLE IF NOT EXISTS admins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'admin',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `;

  const departmentsTable = `
    CREATE TABLE IF NOT EXISTS departments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      department_name VARCHAR(100) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `;

  const complaintsTable = `
    CREATE TABLE IF NOT EXISTS complaints (
      id INT AUTO_INCREMENT PRIMARY KEY,
      complaint_id VARCHAR(30) UNIQUE NOT NULL,
      citizen_id INT NOT NULL,
      title VARCHAR(150) NOT NULL,
      description TEXT NOT NULL,
      category VARCHAR(100) NOT NULL,
      department VARCHAR(100) NOT NULL,
      location VARCHAR(150) NOT NULL,
      priority VARCHAR(20) DEFAULT 'Medium',
      document_path VARCHAR(255) NULL,
      status VARCHAR(30) DEFAULT 'Submitted',
      remarks TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (citizen_id) REFERENCES citizens(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `;

  const complaintHistoryTable = `
    CREATE TABLE IF NOT EXISTS complaint_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      complaint_id VARCHAR(30) NOT NULL,
      old_status VARCHAR(30) NOT NULL,
      new_status VARCHAR(30) NOT NULL,
      remarks TEXT NULL,
      updated_by VARCHAR(100) NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `;

  const notificationsTable = `
    CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      message TEXT NOT NULL,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES citizens(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `;

  await pool.query(citizensTable);
  await pool.query(adminsTable);
  await pool.query(departmentsTable);
  await pool.query(complaintsTable);
  await pool.query(complaintHistoryTable);
  await pool.query(notificationsTable);
  
  console.log('MySQL Database tables verified/created successfully.');
}

async function seedDatabase() {
  const [admins] = await pool.query('SELECT * FROM admins WHERE username = ?', ['admin']);
  if (admins.length === 0) {
    const adminPasswordHash = bcrypt.hashSync('Admin@123', 10);
    await pool.query(
      'INSERT INTO admins (username, name, email, password, role) VALUES (?, ?, ?, ?, ?)',
      ['admin', 'Super Admin', 'admin@grievanceportal.gov', adminPasswordHash, 'superadmin']
    );
    console.log('Default Super Admin seeded in MySQL.');
  }

  const defaultDepts = [
    'Roads', 'Water Supply', 'Electricity', 'Health', 'Education', 'Transport', 'Public Safety', 'Sanitation'
  ];

  for (const dept of defaultDepts) {
    const [existing] = await pool.query('SELECT * FROM departments WHERE department_name = ?', [dept]);
    if (existing.length === 0) {
      await pool.query('INSERT INTO departments (department_name) VALUES (?)', [dept]);
    }
  }
}

async function dbQuery(sql, params = []) {
  if (sqliteDb !== undefined) {
    const translatedSql = translateQuery(sql);
    
    return new Promise((resolve, reject) => {
      const isSelect = translatedSql.trim().toUpperCase().startsWith('SELECT') || 
                       translatedSql.trim().toUpperCase().startsWith('PRAGMA') || 
                       translatedSql.trim().toUpperCase().startsWith('SHOW');
                       
      if (isSelect) {
        sqliteDb.all(translatedSql, params, (err, rows) => {
          if (err) reject(err);
          else resolve([rows, []]);
        });
      } else {
        sqliteDb.run(translatedSql, params, function(err) {
          if (err) reject(err);
          else resolve([{ insertId: this.lastID, affectedRows: this.changes }, []]);
        });
      }
    });
  } else {
    return pool.query(sql, params);
  }
}

module.exports = {
  getPool: () => pool,
  initDB,
  query: dbQuery
};
