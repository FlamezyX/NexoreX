'use strict';

const expressModule = require('express');
const authMiddleware = require('../middleware/auth');
const chatController = require('../controllers/chatController');
const { requireJson, verifyCsrf } = require('../middleware/requestGuards');

const express = expressModule;
const { verifyToken } = authMiddleware;
const { getConversations, getMessages, sendMessage, getUnreadCount } = chatController;

const router = express.Router();

router.get('/conversations', verifyToken, getConversations);
router.get('/unread-count', verifyToken, getUnreadCount);
router.get('/:userId', verifyToken, getMessages);
router.post('/:userId', requireJson, verifyCsrf, verifyToken, sendMessage);

module.exports = router;
