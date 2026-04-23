'use strict';

const expressModule = require('express');
const authMiddleware = require('../middleware/auth');
const reportController = require('../controllers/reportController');

const express = expressModule;
const { verifyToken, requireRole, requirePermission } = authMiddleware;
const { submitReport, getReports, updateReport, getSellerReportSummary } = reportController;

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

router.post('/', verifyCsrf, verifyToken, requireRole('buyer'), submitReport);
router.get('/', verifyToken, requirePermission('manage_reports'), getReports);
router.get('/seller/:sellerId', verifyToken, requirePermission('manage_reports'), getSellerReportSummary);
router.patch('/:id', verifyCsrf, verifyToken, requirePermission('manage_reports'), updateReport);

module.exports = router;
