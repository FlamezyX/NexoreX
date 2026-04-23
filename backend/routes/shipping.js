'use strict';

const expressModule = require('express');
const authMiddleware = require('../middleware/auth');
const shippingController = require('../controllers/shippingController');

const express = expressModule;
const { verifyToken, requirePermission } = authMiddleware;
const {
    getShippingOptions,
    getAllShippingOptions,
    createShippingOption,
    updateShippingOption
} = shippingController;

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

router.get('/', getShippingOptions);
router.get('/admin', verifyToken, requirePermission('manage_shipping'), getAllShippingOptions);
router.post('/', verifyCsrf, verifyToken, requirePermission('manage_shipping'), createShippingOption);
router.patch('/:id', verifyCsrf, verifyToken, requirePermission('manage_shipping'), updateShippingOption);

module.exports = router;
