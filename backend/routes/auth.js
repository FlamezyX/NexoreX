'use strict';

const expressModule = require('express');
const express = expressModule;
const authMiddleware = require('../middleware/auth');
const { verifyToken, requireRole } = authMiddleware;
const authController = require('../controllers/authController');
const { register, login, applySeller, getPromoSettings, forgotPassword, resetPassword } = authController;

const router = express.Router();

function verifyCsrf(req, res, next) {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('application/json')) {
        return res.status(415).json({ message: 'Content-Type must be application/json' });
    }
    next();
}

router.post('/register', verifyCsrf, register);
router.post('/login', verifyCsrf, login);
router.post('/forgot-password', verifyCsrf, forgotPassword);
router.post('/reset-password', verifyCsrf, resetPassword);
router.get('/promo-settings', getPromoSettings);
router.post('/seller-application', verifyCsrf, verifyToken, requireRole('seller'), applySeller);

module.exports = router;
