const mysql = require('mysql2/promise');

const passwords = ['', 'root', 'admin', 'root123', 'mysql', '1234', '123456', 'Admin@123', '12345678'];

async function test() {
  console.log('Testing MySQL root passwords...');
  for (const pw of passwords) {
    try {
      const conn = await mysql.createConnection({
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: pw
      });
      console.log(`\n🎉 SUCCESS: Connection established! Root password is "${pw}"`);
      await conn.end();
      process.exit(0);
    } catch (err) {
      console.log(`- Password "${pw}": ${err.code || err.message}`);
    }
  }
  console.log('\n❌ All common passwords failed.');
  process.exit(1);
}

test();
