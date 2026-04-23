'use strict';

const expressModule = require('express');
const authMiddleware = require('../middleware/auth');
const orderController = require('../controllers/orderController');

const express = expressModule;
const { verifyToken, requireRole, requirePermission } = authMiddleware;
const {
    createCheckout,
    getMyOrders,
    submitPaymentProof,
    confirmPayment,
    updateSellerOrderStatus,
    cancelOrder
} = orderController;

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

router.post('/checkout', verifyCsrf, verifyToken, requireRole('buyer'), createCheckout);
router.get('/my', verifyToken, getMyOrders);
router.patch('/:id/cancel', verifyCsrf, verifyToken, requireRole('buyer'), cancelOrder);
router.patch('/:id/payment', verifyCsrf, verifyToken, requireRole('buyer'), submitPaymentProof);
router.patch('/:id/confirm-payment', verifyCsrf, verifyToken, requirePermission('manage_orders'), confirmPayment);
router.patch('/:id/status', verifyCsrf, verifyToken, requireRole('seller'), updateSellerOrderStatus);

module.exports = router;
