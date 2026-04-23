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

// GET /api/chat/conversations — list all unique conversations for the logged-in user
exports.getConversations = async (req, res) => {
    try {
        const userId = req.user.id;

        const rows = await queryAsync(
            `SELECT
                u.user_id,
                u.fullname,
                u.role,
                m.message AS last_message,
                m.created_at AS last_message_at,
                (
                    SELECT COUNT(*) FROM messages
                    WHERE receiver_id = ? AND sender_id = u.user_id AND is_read = 0
                ) AS unread_count
            FROM users u
            INNER JOIN messages m ON m.message_id = (
                SELECT message_id FROM messages
                WHERE (sender_id = ? AND receiver_id = u.user_id)
                   OR (sender_id = u.user_id AND receiver_id = ?)
                ORDER BY created_at DESC
                LIMIT 1
            )
            WHERE u.user_id != ?
            ORDER BY m.created_at DESC`,
            [userId, userId, userId, userId]
        );

        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET /api/chat/:userId — get message history between logged-in user and another user
exports.getMessages = async (req, res) => {
    try {
        const myId = req.user.id;
        const otherId = Number(req.params.userId);

        if (!otherId || otherId === myId) {
            return res.status(400).json({ message: 'Invalid user' });
        }

        const messages = await queryAsync(
            `SELECT
                m.message_id,
                m.sender_id,
                m.receiver_id,
                m.message,
                m.is_read,
                m.created_at,
                m.product_id,
                p.product_name
            FROM messages m
            LEFT JOIN products p ON m.product_id = p.product_id
            WHERE (m.sender_id = ? AND m.receiver_id = ?)
               OR (m.sender_id = ? AND m.receiver_id = ?)
            ORDER BY m.created_at ASC`,
            [myId, otherId, otherId, myId]
        );

        // Mark received messages as read
        await queryAsync(
            'UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0',
            [otherId, myId]
        );

        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// POST /api/chat/:userId — send a message (REST fallback, Socket.io is primary)
exports.sendMessage = async (req, res) => {
    try {
        const senderId = req.user.id;
        const receiverId = Number(req.params.userId);
        const { message, product_id } = req.body;

        if (!receiverId || receiverId === senderId) {
            return res.status(400).json({ message: 'Invalid receiver' });
        }

        if (!message?.trim()) {
            return res.status(400).json({ message: 'Message cannot be empty' });
        }

        const receiver = await queryAsync(
            'SELECT user_id FROM users WHERE user_id = ?',
            [receiverId]
        );

        if (!receiver.length) {
            return res.status(404).json({ message: 'User not found' });
        }

        const result = await queryAsync(
            'INSERT INTO messages (sender_id, receiver_id, message, product_id) VALUES (?, ?, ?, ?)',
            [senderId, receiverId, message.trim(), product_id || null]
        );

        const inserted = await queryAsync(
            `SELECT m.message_id, m.sender_id, m.receiver_id, m.message, m.is_read, m.created_at,
                    m.product_id, p.product_name
             FROM messages m
             LEFT JOIN products p ON m.product_id = p.product_id
             WHERE m.message_id = ?`,
            [result.insertId]
        );

        res.status(201).json(inserted[0]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET /api/chat/unread-count — total unread messages for the logged-in user
exports.getUnreadCount = async (req, res) => {
    try {
        const userId = req.user.id;
        const rows = await queryAsync(
            'SELECT COUNT(*) AS unread FROM messages WHERE receiver_id = ? AND is_read = 0',
            [userId]
        );
        res.json({ unread: rows[0].unread });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
