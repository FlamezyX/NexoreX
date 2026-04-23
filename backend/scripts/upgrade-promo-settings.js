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

    connection.query(
        `CREATE TABLE IF NOT EXISTS promo_settings (
            promo_setting_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            is_active TINYINT(1) NOT NULL DEFAULT 0,
            promo_title VARCHAR(150) DEFAULT 'Free Store Promo',
            promo_description TEXT DEFAULT NULL,
            promo_questions TEXT DEFAULT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`,
        (createErr) => {
            if (createErr) {
                console.error('Migration failed:', createErr.message);
                connection.end();
                process.exit(1);
                return;
            }

            connection.query(
                'SELECT promo_setting_id FROM promo_settings ORDER BY promo_setting_id DESC LIMIT 1',
                (findErr, rows) => {
                    if (findErr) {
                        console.error('Migration failed:', findErr.message);
                        connection.end();
                        process.exit(1);
                        return;
                    }

                    if (rows.length) {
                        console.log('Promo settings upgrade applied successfully.');
                        connection.end();
                        return;
                    }

                    connection.query(
                        `INSERT INTO promo_settings
                        (is_active, promo_title, promo_description, promo_questions)
                        VALUES (0, 'Free Store Promo', 'Enable this when you want selected applicants to qualify for a free store.', '[]')`,
                        (insertErr) => {
                            if (insertErr) {
                                console.error('Migration failed:', insertErr.message);
                                connection.end();
                                process.exit(1);
                                return;
                            }

                            console.log('Promo settings upgrade applied successfully.');
                            connection.end();
                        }
                    );
                }
            );
        }
    );
});
