'use strict';

const dotenv = require('dotenv');
dotenv.config();
const mysqlModule = require('mysql2');
const mysql = mysqlModule;

const email = process.argv[2];

if (!email) {
    console.error('Usage: node scripts/promote-admin.js <email>');
    process.exit(1);
}

const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'nexoreX'
});

db.query(
    `UPDATE users
     SET role = 'admin',
         admin_level = 1,
         account_status = 'active',
         seller_status = 'not_applied'
     WHERE email = ?`,
    [email.trim().toLowerCase()],
    (err, result) => {
        if (err) {
            console.error('Could not promote admin:', err.message);
            db.end();
            process.exit(1);
        }

        if (result.affectedRows === 0) {
            console.error('No user found with that email');
            db.end();
            process.exit(1);
        }

        console.log(`Promoted ${email.trim().toLowerCase()} to super admin (admin_level = 1)`);
        db.end();
    }
);
