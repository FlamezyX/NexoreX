'use strict';

const expressModule = require('express');
const authMiddleware = require('../middleware/auth');
const adminController = require('../controllers/adminController');
const { requireJson, verifyCsrf } = require('../middleware/requestGuards');

const express = expressModule;
const { verifyToken, requireSuperAdmin, requirePermission } = authMiddleware;
const {
    getSellerApplications,
    reviewSellerApplication,
    getProductsForReview,
    reviewProduct,
    getWithdrawalRequests,
    reviewWithdrawalRequest,
    getAnalytics,
    getPromoSettings,
    updatePromoSettings,
    getPromoLogs,
    verifySellerPayment
} = adminController;

const router = express.Router();

// Seller applications — manage_applications permission
router.get('/applications', verifyToken, requirePermission('manage_applications'), getSellerApplications);
router.patch('/applications/:id/payment', requireJson, verifyCsrf, verifyToken, requirePermission('manage_applications'), verifySellerPayment);
router.patch('/applications/:id', requireJson, verifyCsrf, verifyToken, requirePermission('manage_applications'), reviewSellerApplication);

// Products — manage_products permission
router.get('/products', verifyToken, requirePermission('manage_products'), getProductsForReview);
router.patch('/products/:id', requireJson, verifyCsrf, verifyToken, requirePermission('manage_products'), reviewProduct);

// Withdrawals — manage_withdrawals permission
router.get('/withdrawals', verifyToken, requirePermission('manage_withdrawals'), getWithdrawalRequests);
router.patch('/withdrawals/:id', requireJson, verifyCsrf, verifyToken, requirePermission('manage_withdrawals'), reviewWithdrawalRequest);

// Analytics — view_analytics permission
router.get('/analytics', verifyToken, requirePermission('view_analytics'), getAnalytics);

// Promo — super admin only, sub-admins never have access
router.get('/promo-settings', verifyToken, requireSuperAdmin, getPromoSettings);
router.get('/promo-logs', verifyToken, requireSuperAdmin, getPromoLogs);
router.put('/promo-settings', requireJson, verifyCsrf, verifyToken, requireSuperAdmin, updatePromoSettings);

module.exports = router;
