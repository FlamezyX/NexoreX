'use strict';

const expressModule = require('express');
const authMiddleware = require('../middleware/auth');
const chatController = require('../controllers/chatController');

const express = expressModule;
const { verifyToken } = authMiddleware;
const { getConversations, getMessages, sendMessage, getUnreadCount } = chatController;

const router = express.Router();

function verifyCsrf(req, res, next) {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('application/json')) {
        return res.status(415).json({ message: 'Content-Type must be application/json' });
    }
    const origin = req.headers['origin'];
    const host = req.headers['host'];
    if (origin && host && new URL(origin).host !== host) {
        return res.status(403).json({ message: 'Cross-origin request blocked' });
    }
    next();
}

router.get('/conversations', verifyToken, getConversations);
router.get('/unread-count', verifyToken, getUnreadCount);
router.get('/:userId', verifyToken, getMessages);
router.post('/:userId', verifyCsrf, verifyToken, sendMessage);

module.exports = router;
