'use strict';

const dbModule = require('../db');
const { createNotification } = require('../utils/notifications');

const db = dbModule;

const ALL_PERMISSIONS = [
    'manage_applications',
    'manage_products',
    'manage_orders',
    'manage_withdrawals',
    'manage_shipping',
    'manage_reviews',
    'manage_reports',
    'view_analytics'
];

function queryAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });
}

// GET /api/super-admin/admins — list all admins with their permissions
exports.getAdmins = async (req, res) => {
    try {
        const rows = await queryAsync(
            `SELECT
                u.user_id,
                u.fullname,
                u.email,
                u.admin_level,
                u.account_status,
                u.created_at,
                ap.manage_applications,
                ap.manage_products,
                ap.manage_orders,
                ap.manage_withdrawals,
                ap.manage_shipping,
                ap.manage_reviews,
                ap.manage_reports,
                ap.view_analytics,
                ap.updated_at AS permissions_updated_at
            FROM users u
            LEFT JOIN admin_permissions ap ON u.user_id = ap.admin_id
            WHERE u.role = 'admin'
            ORDER BY u.admin_level ASC, u.created_at ASC`
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// POST /api/super-admin/promote — promote a user to sub-admin
exports.promoteToSubAdmin = async (req, res) => {
    try {
        const superAdminId = req.user.id;
        const { user_id, permissions } = req.body;

        if (!user_id) {
            return res.status(400).json({ message: 'User ID is required' });
        }

        if (Number(user_id) === superAdminId) {
            return res.status(400).json({ message: 'You cannot change your own admin level' });
        }

        const users = await queryAsync(
            'SELECT user_id, fullname, role, admin_level FROM users WHERE user_id = ?',
            [user_id]
        );

        if (!users.length) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = users[0];

        if (user.admin_level === 1) {
            return res.status(400).json({ message: 'Cannot change the level of another super admin' });
        }

        // Promote to admin role with sub-admin level
        await queryAsync(
            `UPDATE users SET role = 'admin', admin_level = 2 WHERE user_id = ?`,
            [user_id]
        );

        // Build permissions — only allow valid keys, promo is never included
        const permPayload = {};
        ALL_PERMISSIONS.forEach(p => {
            permPayload[p] = Array.isArray(permissions) && permissions.includes(p) ? 1 : 0;
        });

        // Upsert permissions
        await queryAsync(
            `INSERT INTO admin_permissions
                (admin_id, manage_applications, manage_products, manage_orders,
                 manage_withdrawals, manage_shipping, manage_reviews, manage_reports, view_analytics)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                manage_applications = VALUES(manage_applications),
                manage_products     = VALUES(manage_products),
                manage_orders       = VALUES(manage_orders),
                manage_withdrawals  = VALUES(manage_withdrawals),
                manage_shipping     = VALUES(manage_shipping),
                manage_reviews      = VALUES(manage_reviews),
                manage_reports      = VALUES(manage_reports),
                view_analytics      = VALUES(view_analytics)`,
            [
                user_id,
                permPayload.manage_applications,
                permPayload.manage_products,
                permPayload.manage_orders,
                permPayload.manage_withdrawals,
                permPayload.manage_shipping,
                permPayload.manage_reviews,
                permPayload.manage_reports,
                permPayload.view_analytics
            ]
        );

        res.status(201).json({ message: `${user.fullname} has been promoted to sub-admin` });

        // Welcome notification — fire after response
        const grantedPerms = Array.isArray(permissions)
            ? permissions.filter(p => ALL_PERMISSIONS.includes(p))
            : [];
        const permLabels = {
            manage_applications: 'Seller Applications',
            manage_products: 'Product Approvals',
            manage_orders: 'Payment Confirmations',
            manage_withdrawals: 'Withdrawals',
            manage_shipping: 'Shipping Options',
            manage_reviews: 'Review Moderation',
            manage_reports: 'Seller Reports',
            view_analytics: 'Analytics'
        };
        const permSummary = grantedPerms.length
            ? grantedPerms.map(p => permLabels[p] || p).join(', ')
            : 'No specific permissions assigned yet';

        createNotification(
            user_id,
            '👑 You have been promoted to Sub-Admin!',
            `Congratulations ${user.fullname}! You now have admin access to NexoreX. Your permissions: ${permSummary}. Log in to access the admin dashboard.`,
            'system'
        ).catch(() => {});
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// PATCH /api/super-admin/permissions/:adminId — update a sub-admin's permissions
exports.updatePermissions = async (req, res) => {
    try {
        const superAdminId = req.user.id;
        const adminId = Number(req.params.adminId);
        const { permissions } = req.body;

        if (adminId === superAdminId) {
            return res.status(400).json({ message: 'You cannot modify your own permissions' });
        }

        const admins = await queryAsync(
            'SELECT user_id, fullname, admin_level FROM users WHERE user_id = ? AND role = ?',
            [adminId, 'admin']
        );

        if (!admins.length) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        if (admins[0].admin_level === 1) {
            return res.status(400).json({ message: 'Cannot modify permissions of a super admin' });
        }

        const permPayload = {};
        ALL_PERMISSIONS.forEach(p => {
            permPayload[p] = Array.isArray(permissions) && permissions.includes(p) ? 1 : 0;
        });

        await queryAsync(
            `INSERT INTO admin_permissions
                (admin_id, manage_applications, manage_products, manage_orders,
                 manage_withdrawals, manage_shipping, manage_reviews, manage_reports, view_analytics)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                manage_applications = VALUES(manage_applications),
                manage_products     = VALUES(manage_products),
                manage_orders       = VALUES(manage_orders),
                manage_withdrawals  = VALUES(manage_withdrawals),
                manage_shipping     = VALUES(manage_shipping),
                manage_reviews      = VALUES(manage_reviews),
                manage_reports      = VALUES(manage_reports),
                view_analytics      = VALUES(view_analytics)`,
            [
                adminId,
                permPayload.manage_applications,
                permPayload.manage_products,
                permPayload.manage_orders,
                permPayload.manage_withdrawals,
                permPayload.manage_shipping,
                permPayload.manage_reviews,
                permPayload.manage_reports,
                permPayload.view_analytics
            ]
        );

        res.json({ message: 'Sub-admin permissions updated successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// DELETE /api/super-admin/demote/:adminId — demote sub-admin back to buyer
exports.demoteAdmin = async (req, res) => {
    try {
        const superAdminId = req.user.id;
        const adminId = Number(req.params.adminId);

        if (adminId === superAdminId) {
            return res.status(400).json({ message: 'You cannot demote yourself' });
        }

        const admins = await queryAsync(
            'SELECT user_id, fullname, admin_level FROM users WHERE user_id = ? AND role = ?',
            [adminId, 'admin']
        );

        if (!admins.length) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        if (admins[0].admin_level === 1) {
            return res.status(400).json({ message: 'Cannot demote a super admin' });
        }

        await queryAsync(
            `UPDATE users SET role = 'buyer', admin_level = NULL WHERE user_id = ?`,
            [adminId]
        );

        await queryAsync(
            'DELETE FROM admin_permissions WHERE admin_id = ?',
            [adminId]
        );

        res.json({ message: `${admins[0].fullname} has been demoted and removed from the admin team` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET /api/super-admin/search-users?q= — search users to promote
exports.searchUsers = async (req, res) => {
    try {
        const query = req.query.q?.trim();
        if (!query || query.length < 2) {
            return res.status(400).json({ message: 'Search query must be at least 2 characters' });
        }

        const users = await queryAsync(
            `SELECT user_id, fullname, email, role, admin_level
             FROM users
             WHERE (fullname LIKE ? OR email LIKE ?)
               AND role != 'admin'
             LIMIT 10`,
            [`%${query}%`, `%${query}%`]
        );

        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET /api/super-admin/search-sellers?q= — search sellers with pending applications for fee waiver
exports.searchSellers = async (req, res) => {
    try {
        const query = req.query.q?.trim();
        if (!query || query.length < 2) {
            return res.status(400).json({ message: 'Search query must be at least 2 characters' });
        }

        const rows = await queryAsync(
            `SELECT
                sa.application_id, sa.business_name, sa.payment_status, sa.store_fee_amount,
                u.user_id, u.fullname, u.email
             FROM seller_applications sa
             INNER JOIN users u ON sa.user_id = u.user_id
             WHERE (u.fullname LIKE ? OR u.email LIKE ? OR sa.business_name LIKE ?)
               AND sa.application_type = 'paid'
               AND sa.status = 'pending'
             ORDER BY sa.submitted_at DESC
             LIMIT 10`,
            [`%${query}%`, `%${query}%`, `%${query}%`]
        );

        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// PATCH /api/super-admin/waive-fee/:applicationId — toggle payment requirement on/off
exports.waiveFee = async (req, res) => {
    try {
        const applicationId = Number(req.params.applicationId);
        const { waive } = req.body; // true = waive fee, false = restore fee

        const apps = await queryAsync(
            `SELECT sa.application_id, sa.payment_status, sa.store_fee_amount, u.fullname
             FROM seller_applications sa
             INNER JOIN users u ON sa.user_id = u.user_id
             WHERE sa.application_id = ? AND sa.application_type = 'paid' AND sa.status = 'pending'`,
            [applicationId]
        );

        if (!apps.length) {
            return res.status(404).json({ message: 'Pending paid application not found' });
        }

        if (waive) {
            await queryAsync(
                `UPDATE seller_applications SET payment_status = 'not_required', store_fee_amount = 0 WHERE application_id = ?`,
                [applicationId]
            );
            return res.json({ message: `Activation fee waived for ${apps[0].fullname}`, payment_status: 'not_required' });
        } else {
            await queryAsync(
                `UPDATE seller_applications SET payment_status = 'pending', store_fee_amount = 3000.00 WHERE application_id = ?`,
                [applicationId]
            );
            return res.json({ message: `Activation fee restored for ${apps[0].fullname}`, payment_status: 'pending' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET /api/super-admin/search-team?q= — search sub-admins and sellers to message
exports.searchTeam = async (req, res) => {
    try {
        const query = req.query.q?.trim();
        if (!query || query.length < 2) {
            return res.status(400).json({ message: 'Search query must be at least 2 characters' });
        }

        const users = await queryAsync(
            `SELECT user_id, fullname, email, role, admin_level
             FROM users
             WHERE (fullname LIKE ? OR email LIKE ?)
               AND (role = 'seller' OR (role = 'admin' AND admin_level = 2))
             LIMIT 15`,
            [`%${query}%`, `%${query}%`]
        );

        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
