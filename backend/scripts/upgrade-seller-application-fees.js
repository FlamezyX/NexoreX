const mysql = require('mysql2');
require('dotenv').config();

const connection = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'nexoreX'
});

const additions = [
    {
        name: 'application_type',
        sql: `ALTER TABLE seller_applications
              ADD COLUMN application_type ENUM('paid', 'promo') NOT NULL DEFAULT 'paid' AFTER location`
    },
    {
        name: 'store_fee_amount',
        sql: `ALTER TABLE seller_applications
              ADD COLUMN store_fee_amount DECIMAL(10, 2) NOT NULL DEFAULT 3000.00 AFTER application_type`
    },
    {
        name: 'payment_status',
        sql: `ALTER TABLE seller_applications
              ADD COLUMN payment_status ENUM('not_required', 'pending', 'submitted', 'verified', 'rejected') NOT NULL DEFAULT 'pending' AFTER store_fee_amount`
    },
    {
        name: 'payment_reference',
        sql: `ALTER TABLE seller_applications
              ADD COLUMN payment_reference VARCHAR(120) DEFAULT NULL AFTER payment_status`
    },
    {
        name: 'promo_status',
        sql: `ALTER TABLE seller_applications
              ADD COLUMN promo_status ENUM('not_applied', 'pending', 'qualified', 'rejected') NOT NULL DEFAULT 'not_applied' AFTER payment_reference`
    },
    {
        name: 'promo_answers',
        sql: `ALTER TABLE seller_applications
              ADD COLUMN promo_answers TEXT DEFAULT NULL AFTER promo_status`
    }
];

connection.connect((connectErr) => {
    if (connectErr) {
        console.error('Migration connection failed:', connectErr.message);
        process.exit(1);
    }

    let index = 0;

    function runNext() {
        if (index >= additions.length) {
            console.log('Seller application fee/promo upgrade applied successfully.');
            connection.end();
            return;
        }

        const addition = additions[index];

        connection.query(
            `SELECT COLUMN_NAME
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'seller_applications' AND COLUMN_NAME = ?`,
            [process.env.DB_NAME || 'nexoreX', addition.name],
            (checkErr, rows) => {
                if (checkErr) {
                    console.error('Migration failed:', checkErr.message);
                    connection.end();
                    process.exit(1);
                    return;
                }

                if (rows.length) {
                    index += 1;
                    runNext();
                    return;
                }

                connection.query(addition.sql, (err) => {
                    if (err) {
                        console.error('Migration failed:', err.message);
                        connection.end();
                        process.exit(1);
                        return;
                    }

                    index += 1;
                    runNext();
                });
            }
        );
    }

    runNext();
});
