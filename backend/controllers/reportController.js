'use strict';

const dbModule = require('../db');
const notificationsModule = require('../utils/notifications');

const db = dbModule;
const { createNotification } = notificationsModule;

function queryAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });
}

const VALID_REASONS = ['fake_listing', 'item_not_as_described', 'rude_behaviour', 'suspected_scam', 'other'];

// POST /api/reports — buyer submits a report against a seller
exports.submitReport = async (req, res) => {
    try {
        const buyerId = req.user.id;
        const { seller_id, reason, description } = req.body;

        if (!seller_id || !reason || !description?.trim()) {
            return res.status(400).json({ message: 'Seller, reason, and description are required' });
        }

        if (!VALID_REASONS.includes(reason)) {
            return res.status(400).json({ message: 'Invalid report reason' });
        }

        if (Number(seller_id) === buyerId) {
            return res.status(400).json({ message: 'You cannot report yourself' });
        }

        // Verify seller exists and is actually a seller
        const sellers = await queryAsync(
            'SELECT user_id FROM users WHERE user_id = ? AND role = ?',
            [seller_id, 'seller']
        );

        if (!sellers.length) {
            return res.status(404).json({ message: 'Seller not found' });
        }

        // Prevent duplicate pending reports from same buyer against same seller
        const existing = await queryAsync(
            `SELECT report_id FROM seller_reports
             WHERE buyer_id = ? AND seller_id = ? AND status = 'pending'`,
            [buyerId, seller_id]
        );

        if (existing.length) {
            return res.status(409).json({ message: 'You already have a pending report against this seller' });
        }

        await queryAsync(
            'INSERT INTO seller_reports (buyer_id, seller_id, reason, description) VALUES (?, ?, ?, ?)',
            [buyerId, Number(seller_id), reason, description.trim()]
        );

        await createNotification(
            buyerId,
            'Report submitted',
            'Your report has been submitted and is pending admin review. Thank you for helping keep Nexore safe.',
            'system'
        );

        res.status(201).json({ message: 'Report submitted successfully. Admin will review it shortly.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET /api/reports — admin gets all reports
exports.getReports = async (req, res) => {
    try {
        const { status } = req.query;
        let sql = `
            SELECT
                sr.report_id,
                sr.reason,
                sr.description,
                sr.status,
                sr.admin_note,
                sr.reviewed_at,
                sr.created_at,
                buyer.user_id  AS buyer_id,
                buyer.fullname AS buyer_name,
                buyer.email    AS buyer_email,
                seller.user_id  AS seller_id,
                seller.fullname AS seller_name,
                seller.email    AS seller_email,
                seller.seller_status,
                (
                    SELECT COUNT(*) FROM seller_reports
                    WHERE seller_id = sr.seller_id
                ) AS seller_total_reports
            FROM seller_reports sr
            INNER JOIN users buyer  ON sr.buyer_id  = buyer.user_id
            INNER JOIN users seller ON sr.seller_id = seller.user_id
        `;
        const params = [];

        if (status && ['pending', 'reviewed', 'dismissed'].includes(status)) {
            sql += ' WHERE sr.status = ?';
            params.push(status);
        }

        sql += ' ORDER BY sr.created_at DESC';

        const reports = await queryAsync(sql, params);
        res.json(reports);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// PATCH /api/reports/:id — admin updates report status
exports.updateReport = async (req, res) => {
    try {
        const reportId = req.params.id;
        const { status, admin_note } = req.body;

        if (!['reviewed', 'dismissed'].includes(status)) {
            return res.status(400).json({ message: 'Status must be reviewed or dismissed' });
        }

        const reports = await queryAsync(
            `SELECT report_id, buyer_id, seller_id FROM seller_reports WHERE report_id = ?`,
            [reportId]
        );

        if (!reports.length) {
            return res.status(404).json({ message: 'Report not found' });
        }

        const report = reports[0];

        await queryAsync(
            `UPDATE seller_reports
             SET status = ?, admin_note = ?, reviewed_at = NOW()
             WHERE report_id = ?`,
            [status, admin_note?.trim() || null, reportId]
        );

        // Notify the buyer their report was reviewed
        await createNotification(
            report.buyer_id,
            'Report reviewed',
            status === 'reviewed'
                ? 'Your seller report has been reviewed by admin. Thank you for helping keep Nexore safe.'
                : 'Your seller report has been reviewed and dismissed by admin.',
            'system'
        );

        res.json({ message: `Report marked as ${status}` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET /api/reports/summary/:sellerId — admin gets report summary for a specific seller
exports.getSellerReportSummary = async (req, res) => {
    try {
        const sellerId = req.params.sellerId;

        const rows = await queryAsync(
            `SELECT
                COUNT(*) AS total_reports,
                SUM(CASE WHEN status = 'pending'   THEN 1 ELSE 0 END) AS pending,
                SUM(CASE WHEN status = 'reviewed'  THEN 1 ELSE 0 END) AS reviewed,
                SUM(CASE WHEN status = 'dismissed' THEN 1 ELSE 0 END) AS dismissed,
                SUM(CASE WHEN reason = 'fake_listing'          THEN 1 ELSE 0 END) AS fake_listing,
                SUM(CASE WHEN reason = 'item_not_as_described' THEN 1 ELSE 0 END) AS item_not_as_described,
                SUM(CASE WHEN reason = 'rude_behaviour'        THEN 1 ELSE 0 END) AS rude_behaviour,
                SUM(CASE WHEN reason = 'suspected_scam'        THEN 1 ELSE 0 END) AS suspected_scam,
                SUM(CASE WHEN reason = 'other'                 THEN 1 ELSE 0 END) AS other
             FROM seller_reports
             WHERE seller_id = ?`,
            [sellerId]
        );

        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
