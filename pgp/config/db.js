const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};

let pool;

async function initDB() {
  try {
    // Connect without database name first to ensure database exists
    const connection = await mysql.createConnection(dbConfig);
    const dbName = process.env.DB_NAME || 'citizen_grievance_db';
    
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await connection.end();

    // Now connect with database name
    pool = mysql.createPool({
      ...dbConfig,
      database: dbName,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    console.log(`Database connected: ${dbName}`);

    // Create tables
    await createTables();

    // Seed data
    await seedDatabase();

  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
}

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
  
  console.log('Database tables verified/created successfully.');
}

async function seedDatabase() {
  // Seed Default Super Admin
  const [admins] = await pool.query('SELECT * FROM admins WHERE username = ?', ['admin']);
  if (admins.length === 0) {
    const adminPasswordHash = bcrypt.hashSync('Admin@123', 10);
    await pool.query(
      'INSERT INTO admins (username, name, email, password, role) VALUES (?, ?, ?, ?, ?)',
      ['admin', 'Super Admin', 'admin@grievanceportal.gov', adminPasswordHash, 'superadmin']
    );
    console.log('Default Super Admin created: admin / Admin@123');
  }

  // Seed Default Departments
  const defaultDepts = [
    'Roads',
    'Water Supply',
    'Electricity',
    'Health',
    'Education',
    'Transport',
    'Public Safety',
    'Sanitation'
  ];

  for (const dept of defaultDepts) {
    const [existing] = await pool.query('SELECT * FROM departments WHERE department_name = ?', [dept]);
    if (existing.length === 0) {
      await pool.query('INSERT INTO departments (department_name) VALUES (?)', [dept]);
    }
  }
  console.log('Default departments verified/seeded.');
}

module.exports = {
  getPool: () => pool,
  initDB,
  query: (sql, params) => pool.query(sql, params)
};
