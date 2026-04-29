'use strict';

const express = require('express');
const { verifyToken, requireRole, requirePermission } = require('../middleware/auth');
const { requireJson, verifyCsrf } = require('../middleware/requestGuards');
const {
    createPost, getFeed, getMyPosts,
    getAdminPosts, reviewPost, toggleLike, deletePost
} = require('../controllers/postController');

const router = express.Router();

router.get('/feed', getFeed);                                                                          // public
router.get('/my', verifyToken, requireRole('seller'), getMyPosts);                                    // seller
router.get('/admin', verifyToken, requirePermission('manage_products'), getAdminPosts);               // admin
router.post('/', requireJson, verifyCsrf, verifyToken, requireRole('seller'), createPost);                        // seller
router.patch('/:id/review', requireJson, verifyCsrf, verifyToken, requirePermission('manage_products'), reviewPost); // admin
router.post('/:id/like', requireJson, verifyCsrf, verifyToken, toggleLike);                                       // any logged-in user
router.delete('/:id', requireJson, verifyCsrf, verifyToken, requireRole('seller'), deletePost);                   // seller

module.exports = router;
