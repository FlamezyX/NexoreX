'use strict';

const expressModule = require('express');
const authMiddleware = require('../middleware/auth');
const walletController = require('../controllers/walletController');
const { requireJson, verifyCsrf } = require('../middleware/requestGuards');

const express = expressModule;
const { verifyToken, requireRole } = authMiddleware;
const { getMyWallet, requestWithdrawal } = walletController;

const router = express.Router();

router.get('/me', verifyToken, requireRole('seller'), getMyWallet);
router.post('/withdrawals', requireJson, verifyCsrf, verifyToken, requireRole('seller'), requestWithdrawal);

module.exports = router;
