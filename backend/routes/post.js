'use strict';

const express = require('express');
const { verifyToken, requireRole, requirePermission } = require('../middleware/auth');
const {
    createPost, getFeed, getMyPosts,
    getAdminPosts, reviewPost, toggleLike, deletePost
} = require('../controllers/postController');

const router = express.Router();

function requireJson(req, res, next) {
    if (!req.is('application/json')) return res.status(415).json({ message: 'Content-Type must be application/json' });
    next();
}

router.get('/feed', getFeed);                                                                          // public
router.get('/my', verifyToken, requireRole('seller'), getMyPosts);                                    // seller
router.get('/admin', verifyToken, requirePermission('manage_products'), getAdminPosts);               // admin
router.post('/', requireJson, verifyToken, requireRole('seller'), createPost);                        // seller
router.patch('/:id/review', requireJson, verifyToken, requirePermission('manage_products'), reviewPost); // admin
router.post('/:id/like', requireJson, verifyToken, toggleLike);                                       // any logged-in user
router.delete('/:id', requireJson, verifyToken, requireRole('seller'), deletePost);                   // seller

module.exports = router;
