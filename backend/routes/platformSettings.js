'use strict';

const express = require('express');
const { verifyToken, requireSuperAdmin } = require('../middleware/auth');
const { getSettings, updateSettings } = require('../controllers/platformSettingsController');

const router = express.Router();

function requireJson(req, res, next) {
    if (!req.is('application/json')) return res.status(415).json({ message: 'Content-Type must be application/json' });
    next();
}

router.get('/', getSettings);
router.put('/', requireJson, verifyToken, requireSuperAdmin, updateSettings);

module.exports = router;
