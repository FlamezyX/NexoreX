'use strict';

const express = require('express');
const { verifyToken, requireSuperAdmin } = require('../middleware/auth');
const { getSettings, updateSettings } = require('../controllers/platformSettingsController');
const { requireJson, verifyCsrf } = require('../middleware/requestGuards');

const router = express.Router();

router.get('/', getSettings);
router.put('/', requireJson, verifyCsrf, verifyToken, requireSuperAdmin, updateSettings);

module.exports = router;
