'use strict';

const expressModule = require('express');
const authMiddleware = require('../middleware/auth');
const reviewController = require('../controllers/reviewController');
const { requireJson, verifyCsrf } = require('../middleware/requestGuards');

const express = expressModule;
const { verifyToken, requireRole, requirePermission } = authMiddleware;
const {
    createReview,
    getProductReviews,
    getReviewsForModeration,
    moderateReview
} = reviewController;

const router = express.Router();

router.get('/product/:productId', getProductReviews);
router.get('/moderation', verifyToken, requirePermission('manage_reviews'), getReviewsForModeration);
router.post('/', requireJson, verifyCsrf, verifyToken, requireRole('buyer'), createReview);
router.patch('/:id', requireJson, verifyCsrf, verifyToken, requirePermission('manage_reviews'), moderateReview);

module.exports = router;
