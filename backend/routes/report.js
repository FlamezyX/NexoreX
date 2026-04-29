'use strict';

const expressModule = require('express');
const authMiddleware = require('../middleware/auth');
const reportController = require('../controllers/reportController');
const { requireJson, verifyCsrf } = require('../middleware/requestGuards');

const express = expressModule;
const { verifyToken, requireRole, requirePermission } = authMiddleware;
const { submitReport, getReports, updateReport, getSellerReportSummary } = reportController;

const router = express.Router();

router.post('/', requireJson, verifyCsrf, verifyToken, requireRole('buyer'), submitReport);
router.get('/', verifyToken, requirePermission('manage_reports'), getReports);
router.get('/seller/:sellerId', verifyToken, requirePermission('manage_reports'), getSellerReportSummary);
router.patch('/:id', requireJson, verifyCsrf, verifyToken, requirePermission('manage_reports'), updateReport);

module.exports = router;
