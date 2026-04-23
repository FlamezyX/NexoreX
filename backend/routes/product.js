'use strict';

const express = require('express');
const { verifyToken, requireRole } = require('../middleware/auth');
const {
    addProduct,
    getProducts,
    getSellerProducts,
    getSellerProfile,
    uploadProductImage
} = require('../controllers/productController');

const router = express.Router();

function requireJson(req, res, next) {
    if (!req.is('application/json')) {
        return res.status(415).json({ message: 'Content-Type must be application/json' });
    }
    next();
}

router.post('/upload-image', requireJson, verifyToken, requireRole('seller'), uploadProductImage);
router.post('/add', requireJson, verifyToken, requireRole('seller'), addProduct);
router.get('/', getProducts);
router.get('/seller-profile/:sellerId', getSellerProfile);
router.get('/seller/:sellerId', verifyToken, requireRole('seller', 'admin'), getSellerProducts);

module.exports = router;
