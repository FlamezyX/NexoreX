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
        `SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'seller_applications' AND COLUMN_NAME = 'payment_verified_at'`,
        [process.env.DB_NAME || 'nexoreX'],
        (checkErr, rows) => {
            if (checkErr) {
                console.error('Migration failed:', checkErr.message);
                connection.end();
                process.exit(1);
                return;
            }

            const continueWithPromoLogs = () => {
                connection.query(
                    `CREATE TABLE IF NOT EXISTS promo_logs (
                        promo_log_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                        admin_user_id INT DEFAULT NULL,
                        action_type ENUM('activated', 'deactivated', 'updated_questions') NOT NULL,
                        title_snapshot VARCHAR(150) DEFAULT NULL,
                        description_snapshot TEXT DEFAULT NULL,
                        questions_snapshot TEXT DEFAULT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        CONSTRAINT fk_promo_logs_admin
                            FOREIGN KEY (admin_user_id) REFERENCES users(user_id)
                            ON DELETE SET NULL
                    )`,
                    (createErr) => {
                        if (createErr) {
                            console.error('Migration failed:', createErr.message);
                            connection.end();
                            process.exit(1);
                            return;
                        }

                        console.log('Promo operations upgrade applied successfully.');
                        connection.end();
                    }
                );
            };

            if (rows.length) {
                continueWithPromoLogs();
                return;
            }

            connection.query(
                `ALTER TABLE seller_applications
                 ADD COLUMN payment_verified_at DATETIME DEFAULT NULL AFTER payment_status`,
                (alterErr) => {
                    if (alterErr) {
                        console.error('Migration failed:', alterErr.message);
                        connection.end();
                        process.exit(1);
                        return;
                    }

                    continueWithPromoLogs();
                }
            );
        }
    );
});
