const mysql = require('mysql2');
require('dotenv').config();

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 20000
});

db.getConnection((err, connection) => {
    if (err) {
        console.error('DB connection failed:', err.message);
    } else {
        console.log(`Connected to database: ${process.env.DB_NAME}`);
        connection.release();
    }
});

module.exports = db;
