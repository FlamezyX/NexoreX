'use strict';

const dbModule = require('../db');

const db = dbModule;

function queryAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });
}

exports.getMyNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        const notifications = await queryAsync(
            `SELECT
                notification_id,
                title,
                message,
                notification_type,
                is_read,
                created_at
            FROM notifications
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 20`,
            [userId]
        );

        res.json(notifications);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.markNotificationRead = async (req, res) => {
    try {
        const userId = req.user.id;
        const notificationId = req.params.id;
        const result = await queryAsync(
            `UPDATE notifications
             SET is_read = 1
             WHERE notification_id = ? AND user_id = ?`,
            [notificationId, userId]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.markAllNotificationsRead = async (req, res) => {
    try {
        const userId = req.user.id;
        await queryAsync(
            'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
            [userId]
        );

        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
