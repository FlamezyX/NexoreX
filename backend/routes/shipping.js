'use strict';

const expressModule = require('express');
const authMiddleware = require('../middleware/auth');
const shippingController = require('../controllers/shippingController');
const { requireJson, verifyCsrf } = require('../middleware/requestGuards');

const express = expressModule;
const { verifyToken, requirePermission } = authMiddleware;
const {
    getShippingOptions,
    getAllShippingOptions,
    createShippingOption,
    updateShippingOption
} = shippingController;

const router = express.Router();

router.get('/', getShippingOptions);
router.get('/admin', verifyToken, requirePermission('manage_shipping'), getAllShippingOptions);
router.post('/', requireJson, verifyCsrf, verifyToken, requirePermission('manage_shipping'), createShippingOption);
router.patch('/:id', requireJson, verifyCsrf, verifyToken, requirePermission('manage_shipping'), updateShippingOption);

module.exports = router;
