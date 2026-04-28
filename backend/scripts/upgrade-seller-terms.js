'use strict';
require('dotenv').config();
const db = require('../db');

db.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'seller_applications' AND COLUMN_NAME = 'terms_accepted_at'`,
    (err, rows) => {
        if (err) { console.error('Migration failed:', err.message); process.exit(1); }
        if (rows[0].cnt > 0) {
            console.log('terms_accepted_at column already exists, skipping.');
            return process.exit(0);
        }
        db.query(
            `ALTER TABLE seller_applications ADD COLUMN terms_accepted_at DATETIME DEFAULT NULL`,
            (err2) => {
                if (err2) { console.error('Migration failed:', err2.message); process.exit(1); }
                console.log('seller_applications.terms_accepted_at column ready');
                process.exit(0);
            }
        );
    }
);
