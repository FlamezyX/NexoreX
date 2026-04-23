'use strict';

const dbModule = require('../db');
const db = dbModule;

function createNotification(userId, title, message, notificationType = 'system') {
    return new Promise((resolve, reject) => {
        db.query(
            `INSERT INTO notifications
            (user_id, title, message, notification_type)
            VALUES (?, ?, ?, ?)`,
            [userId, title, message, notificationType],
            (err, result) => {
                if (err) reject(err);
                else resolve(result);
            }
        );
    });
}

module.exports = {
    createNotification
};
