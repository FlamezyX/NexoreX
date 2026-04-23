'use strict';

const expressModule = require('express');
const authMiddleware = require('../middleware/auth');
const reviewController = require('../controllers/reviewController');

const express = expressModule;
const { verifyToken, requireRole, requirePermission } = authMiddleware;
const {
    createReview,
    getProductReviews,
    getReviewsForModeration,
    moderateReview
} = reviewController;

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

router.get('/product/:productId', getProductReviews);
router.get('/moderation', verifyToken, requirePermission('manage_reviews'), getReviewsForModeration);
router.post('/', verifyCsrf, verifyToken, requireRole('buyer'), createReview);
router.patch('/:id', verifyCsrf, verifyToken, requirePermission('manage_reviews'), moderateReview);

module.exports = router;
