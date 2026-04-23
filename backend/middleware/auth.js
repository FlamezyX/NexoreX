'use strict';

const jwtModule = require('jsonwebtoken');
const dbModule = require('../db');

const jwt = jwtModule;
const db = dbModule;

function getTokenFromHeader(req) {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) return null;
    return authHeader.slice(7);
}

exports.verifyToken = (req, res, next) => {
    const token = getTokenFromHeader(req);
    if (!token) {
        return res.status(401).json({ message: 'Authentication token is required' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};

exports.requireRole = (...roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ message: 'You do not have permission to perform this action' });
    }
    next();
};

// Only super admins (admin_level = 1) can access
exports.requireSuperAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Super admin access required' });
    }
    // Use admin_level from JWT if present, otherwise fall back to DB check
    if (req.user.admin_level === 1) return next();
    db.query(
        'SELECT admin_level FROM users WHERE user_id = ?',
        [req.user.id],
        (err, rows) => {
            if (err || !rows.length || rows[0].admin_level !== 1) {
                return res.status(403).json({ message: 'Super admin access required' });
            }
            next();
        }
    );
};

// Check a specific permission for sub-admins; super admins always pass
exports.requirePermission = (permission) => (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ message: 'You do not have permission to perform this action' });
    }
    db.query(
        'SELECT admin_level FROM users WHERE user_id = ?',
        [req.user.id],
        (err, rows) => {
            if (err || !rows.length) {
                return res.status(403).json({ message: 'You do not have permission to perform this action' });
            }
            // Super admin always passes
            if (rows[0].admin_level === 1) return next();

            // Sub-admin — check specific permission
            db.query(
                `SELECT ${permission} AS has_permission FROM admin_permissions WHERE admin_id = ?`,
                [req.user.id],
                (err2, permRows) => {
                    if (err2 || !permRows.length || !permRows[0].has_permission) {
                        return res.status(403).json({ message: 'You do not have permission to perform this action' });
                    }
                    next();
                }
            );
        }
    );
};
