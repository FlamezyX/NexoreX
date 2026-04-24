'use strict';
require('dotenv').config();
const db = require('../db');

db.query(
    `ALTER TABLE seller_applications
     ADD COLUMN IF NOT EXISTS terms_accepted_at DATETIME DEFAULT NULL`,
    (err) => {
        if (err) { console.error('Migration failed:', err.message); process.exit(1); }
        console.log('seller_applications.terms_accepted_at column ready');
        process.exit(0);
    }
);
