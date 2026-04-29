'use strict';

const expressModule = require('express');
const authMiddleware = require('../middleware/auth');
const orderController = require('../controllers/orderController');
const { requireJson, verifyCsrf } = require('../middleware/requestGuards');

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

router.post('/checkout', requireJson, verifyCsrf, verifyToken, requireRole('buyer'), createCheckout);
router.get('/my', verifyToken, getMyOrders);
router.patch('/:id/cancel', requireJson, verifyCsrf, verifyToken, requireRole('buyer'), cancelOrder);
router.patch('/:id/payment', requireJson, verifyCsrf, verifyToken, requireRole('buyer'), submitPaymentProof);
router.patch('/:id/confirm-payment', requireJson, verifyCsrf, verifyToken, requirePermission('manage_orders'), confirmPayment);
router.patch('/:id/status', requireJson, verifyCsrf, verifyToken, requireRole('seller'), updateSellerOrderStatus);

module.exports = router;
