'use strict';

const expressModule = require('express');
const authMiddleware = require('../middleware/auth');
const superAdminController = require('../controllers/superAdminController');

const express = expressModule;
const { verifyToken, requireSuperAdmin } = authMiddleware;
const { getAdmins, promoteToSubAdmin, updatePermissions, demoteAdmin, searchUsers, searchTeam } = superAdminController;

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

router.get('/admins', verifyToken, requireSuperAdmin, getAdmins);
router.get('/search-users', verifyToken, requireSuperAdmin, searchUsers);
router.get('/search-team', verifyToken, requireSuperAdmin, searchTeam);
router.post('/promote', verifyCsrf, verifyToken, requireSuperAdmin, promoteToSubAdmin);
router.patch('/permissions/:adminId', verifyCsrf, verifyToken, requireSuperAdmin, updatePermissions);
router.delete('/demote/:adminId', verifyCsrf, verifyToken, requireSuperAdmin, demoteAdmin);

module.exports = router;
