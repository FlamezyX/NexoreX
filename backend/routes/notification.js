'use strict';

const expressModule = require('express');
const authMiddleware = require('../middleware/auth');
const notificationController = require('../controllers/notificationController');

const express = expressModule;
const { verifyToken } = authMiddleware;
const {
    getMyNotifications,
    markNotificationRead,
    markAllNotificationsRead
} = notificationController;

const router = express.Router();

function verifyCsrf(req, res, next) {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('application/json')) {
        return res.status(415).json({ message: 'Content-Type must be application/json' });
    }
    next();
}

router.get('/my', verifyToken, getMyNotifications);
router.patch('/read-all', verifyCsrf, verifyToken, markAllNotificationsRead);
router.patch('/:id/read', verifyCsrf, verifyToken, markNotificationRead);

module.exports = router;
