'use strict';

const dotenv = require('dotenv');
const pathModule = require('path');
dotenv.config({ path: pathModule.join(__dirname, '..', '.env') });

const dbModule = require('../db');
const db = dbModule;

function runQuery(sql) {
    return new Promise((resolve, reject) => {
        db.query(sql, (error, results) => {
            if (error) reject(error);
            else resolve(results);
        });
    });
}

async function columnExists(tableName, columnName) {
    const rows = await runQuery(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = '${tableName}'
           AND COLUMN_NAME = '${columnName}'`
    );

    return rows.length > 0;
}

async function main() {
    try {
        const exists = await columnExists('seller_applications', 'payment_proof_url');

        if (!exists) {
            await runQuery(
                `ALTER TABLE seller_applications
                 ADD COLUMN payment_proof_url TEXT DEFAULT NULL AFTER payment_reference`
            );
            console.log('Added seller_applications.payment_proof_url');
        } else {
            console.log('seller_applications.payment_proof_url already exists');
        }
    } catch (error) {
        console.error('Seller payment proof upgrade failed:', error.message);
        process.exitCode = 1;
    } finally {
        db.end();
    }
}

main();
