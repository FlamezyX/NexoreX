'use strict';

const expressModule = require('express');
const authMiddleware = require('../middleware/auth');
const notificationController = require('../controllers/notificationController');
const { requireJson } = require('../middleware/requestGuards');

const express = expressModule;
const { verifyToken } = authMiddleware;
const {
    getMyNotifications,
    markNotificationRead,
    markAllNotificationsRead
} = notificationController;

const router = express.Router();

router.get('/my', verifyToken, getMyNotifications);
router.patch('/read-all', requireJson, verifyToken, markAllNotificationsRead);
router.patch('/:id/read', requireJson, verifyToken, markNotificationRead);

module.exports = router;
