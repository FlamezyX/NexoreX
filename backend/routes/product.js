'use strict';

const express = require('express');
const { verifyToken, requireRole } = require('../middleware/auth');
const { requireJson, verifyCsrf } = require('../middleware/requestGuards');
const {
    addProduct,
    getProducts,
    getSellerProducts,
    getSellerProfile,
    uploadProductImage
} = require('../controllers/productController');

const router = express.Router();

router.post('/upload-image', requireJson, verifyCsrf, verifyToken, requireRole('seller'), uploadProductImage);
router.post('/add', requireJson, verifyCsrf, verifyToken, requireRole('seller'), addProduct);
router.get('/', getProducts);
router.get('/seller-profile/:sellerId', getSellerProfile);
router.get('/seller/:sellerId', verifyToken, requireRole('seller', 'admin'), getSellerProducts);

module.exports = router;
