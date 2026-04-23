'use strict';

const expressModule = require('express');
const authMiddleware = require('../middleware/auth');
const walletController = require('../controllers/walletController');

const express = expressModule;
const { verifyToken, requireRole } = authMiddleware;
const { getMyWallet, requestWithdrawal } = walletController;

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

router.get('/me', verifyToken, requireRole('seller'), getMyWallet);
router.post('/withdrawals', verifyCsrf, verifyToken, requireRole('seller'), requestWithdrawal);

module.exports = router;
