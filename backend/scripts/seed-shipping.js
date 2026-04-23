'use strict';

const dotenv = require('dotenv');
dotenv.config();
const mysqlModule = require('mysql2');
const mysql = mysqlModule;

const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'nexoreX'
});

db.query('SELECT COUNT(*) AS count FROM shipping_options', (countErr, rows) => {
    if (countErr) {
        console.error('Could not read shipping options:', countErr.message);
        db.end();
        process.exit(1);
    }

    if (rows[0].count > 0) {
        console.log('Shipping options already exist');
        db.end();
        return;
    }

    db.query(
        `INSERT INTO shipping_options (name, description, delivery_time, price) VALUES
         ('Standard', 'Regular marketplace delivery', '3-5 days', 10.00),
         ('Express', 'Faster delivery option', '1-2 days', 18.00),
         ('Same Day', 'Fastest local delivery where available', 'Same day', 25.00),
         ('Pickup', 'Coordinate pickup directly with the seller', 'Arranged', 0.00)`,
        (insertErr) => {
            if (insertErr) {
                console.error('Could not seed shipping options:', insertErr.message);
                db.end();
                process.exit(1);
            }

            console.log('Seeded default shipping options');
            db.end();
        }
    );
});
