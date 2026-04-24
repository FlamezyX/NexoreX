'use strict';

const db = require('../db');

function queryAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });
}

const ALLOWED_KEYS = ['bank_name', 'bank_account_name', 'bank_account_number', 'bank_instructions', 'withdrawal_hold_hours', 'min_withdrawal_amount', 'seller_terms'];

// GET /api/platform-settings — public, used by checkout and orders pages
exports.getSettings = async (req, res) => {
    try {
        const rows = await queryAsync('SELECT setting_key, setting_value FROM platform_settings');
        const settings = {};
        rows.forEach(r => { settings[r.setting_key] = r.setting_value; });
        res.json(settings);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// PUT /api/platform-settings — super admin only
exports.updateSettings = async (req, res) => {
    try {
        const updates = req.body;
        const keys = Object.keys(updates).filter(k => ALLOWED_KEYS.includes(k));

        if (!keys.length) return res.status(400).json({ message: 'No valid settings provided' });

        for (const key of keys) {
            await queryAsync(
                `INSERT INTO platform_settings (setting_key, setting_value)
                 VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
                [key, String(updates[key] || '').trim()]
            );
        }

        res.json({ message: 'Bank details updated successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
