'use strict';

const expressModule = require('express');
const authMiddleware = require('../middleware/auth');
const superAdminController = require('../controllers/superAdminController');
const { requireJson, verifyCsrf } = require('../middleware/requestGuards');

const express = expressModule;
const { verifyToken, requireSuperAdmin } = authMiddleware;
const {
    getAdmins,
    getUsersOverview,
    promoteToSubAdmin,
    updatePermissions,
    demoteAdmin,
    searchUsers,
    searchTeam,
    waiveFee,
    searchSellers,
    getAnalytics
} = superAdminController;

const router = express.Router();

router.get('/admins', verifyToken, requireSuperAdmin, getAdmins);
router.get('/users-overview', verifyToken, requireSuperAdmin, getUsersOverview);
router.get('/analytics', verifyToken, requireSuperAdmin, getAnalytics);
router.get('/search-users', verifyToken, requireSuperAdmin, searchUsers);
router.get('/search-team', verifyToken, requireSuperAdmin, searchTeam);
router.post('/promote', requireJson, verifyCsrf, verifyToken, requireSuperAdmin, promoteToSubAdmin);
router.patch('/permissions/:adminId', requireJson, verifyCsrf, verifyToken, requireSuperAdmin, updatePermissions);
router.delete('/demote/:adminId', requireJson, verifyCsrf, verifyToken, requireSuperAdmin, demoteAdmin);
router.get('/search-sellers', verifyToken, requireSuperAdmin, searchSellers);
router.patch('/waive-fee/:applicationId', requireJson, verifyCsrf, verifyToken, requireSuperAdmin, waiveFee);

module.exports = router;
