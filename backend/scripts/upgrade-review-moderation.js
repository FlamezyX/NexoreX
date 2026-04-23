const mysql = require('mysql2');
require('dotenv').config();

const connection = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'nexoreX'
});

connection.connect((connectErr) => {
    if (connectErr) {
        console.error('Migration connection failed:', connectErr.message);
        process.exit(1);
    }

    const additions = [
        {
            name: 'review_status',
            sql: `ALTER TABLE reviews
                  ADD COLUMN review_status ENUM('published', 'hidden', 'flagged') NOT NULL DEFAULT 'published' AFTER comment`
        },
        {
            name: 'admin_note',
            sql: `ALTER TABLE reviews
                  ADD COLUMN admin_note TEXT DEFAULT NULL AFTER review_status`
        },
        {
            name: 'moderated_at',
            sql: `ALTER TABLE reviews
                  ADD COLUMN moderated_at DATETIME DEFAULT NULL AFTER admin_note`
        }
    ];

    let index = 0;

    function runNext() {
        if (index >= additions.length) {
            console.log('Review moderation upgrade applied successfully.');
            connection.end();
            return;
        }

        const addition = additions[index];
        connection.query(
            `SELECT COLUMN_NAME
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'reviews' AND COLUMN_NAME = ?`,
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
