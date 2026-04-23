const db = require('../db');
const { createNotification } = require('../utils/notifications');

function ensureAdmin(adminId, callback) {
    if (!adminId) {
        return callback({ status: 400, body: { message: 'Admin ID is required' } });
    }

    db.query(
        'SELECT user_id, role FROM users WHERE user_id = ?',
        [adminId],
        (err, results) => {
            if (err) return callback({ status: 500, body: err });

            if (results.length === 0) {
                return callback({ status: 404, body: { message: 'Admin user not found' } });
            }

            if (results[0].role !== 'admin') {
                return callback({ status: 403, body: { message: 'Only admin accounts can perform this action' } });
            }

            callback(null, results[0]);
        }
    );
}

exports.getSellerApplications = (req, res) => {
    const adminId = req.user.id;

    ensureAdmin(adminId, (authErr) => {
        if (authErr) return res.status(authErr.status).json(authErr.body);

        db.query(
            `SELECT
                sa.application_id,
                sa.user_id,
                sa.business_name,
                sa.business_description,
                sa.phone,
                sa.location,
                sa.application_type,
                sa.store_fee_amount,
                sa.payment_status,
                sa.payment_verified_at,
                sa.payment_reference,
                sa.payment_proof_url,
                sa.promo_status,
                sa.promo_answers,
                sa.status,
                sa.admin_note,
                sa.submitted_at,
                sa.reviewed_at,
                u.fullname,
                u.email,
                u.seller_status
            FROM seller_applications sa
            INNER JOIN users u ON sa.user_id = u.user_id
            ORDER BY sa.submitted_at DESC`,
            (err, results) => {
                if (err) return res.status(500).json(err);
                res.json(results);
            }
        );
    });
};

exports.reviewSellerApplication = (req, res) => {
    const applicationId = req.params.id;
    const adminId = req.user.id;
    const status = req.body.status;
    const adminNote = req.body.admin_note ?? req.body.adminNote ?? null;

    if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'Status must be approved or rejected' });
    }

    ensureAdmin(adminId, (authErr) => {
        if (authErr) return res.status(authErr.status).json(authErr.body);

        db.query(
            `SELECT application_id, user_id, status, application_type, payment_status
             FROM seller_applications
             WHERE application_id = ?`,
            [applicationId],
            (findErr, applicationResults) => {
                if (findErr) return res.status(500).json(findErr);

                if (applicationResults.length === 0) {
                    return res.status(404).json({ message: 'Seller application not found' });
                }

                const application = applicationResults[0];

                if (status === 'approved' && application.application_type === 'paid' && application.payment_status !== 'verified') {
                    return res.status(400).json({
                        message: 'Paid seller applications must have payment verified before approval'
                    });
                }

                db.query(
                    `UPDATE seller_applications
                     SET status = ?,
                         admin_note = ?,
                         payment_status = CASE
                            WHEN application_type = 'paid' AND ? = 'rejected' THEN 'rejected'
                            ELSE payment_status
                         END,
                         promo_status = CASE
                            WHEN application_type = 'promo' AND ? = 'approved' THEN 'qualified'
                            WHEN application_type = 'promo' AND ? = 'rejected' THEN 'rejected'
                            ELSE promo_status
                         END,
                         reviewed_at = NOW()
                     WHERE application_id = ?`,
                    [status, adminNote, status, status, status, applicationId],
                    (updateErr) => {
                        if (updateErr) return res.status(500).json(updateErr);

                        const userSellerStatus = status === 'approved' ? 'approved' : 'rejected';

                        db.query(
                            `UPDATE users
                             SET seller_status = ?,
                                 seller_approved_at = ${status === 'approved' ? 'NOW()' : 'NULL'}
                             WHERE user_id = ?`,
                            [userSellerStatus, application.user_id],
                            (userErr) => {
                                if (userErr) return res.status(500).json(userErr);

                                if (status !== 'approved') {
                                    createNotification(
                                        application.user_id,
                                        'Seller application reviewed',
                                        'Your seller application was reviewed and is currently rejected. Check admin notes for guidance.',
                                        'system'
                                    ).catch(() => {});

                                    return res.json({ message: 'Seller application reviewed successfully' });
                                }

                                db.query(
                                    'INSERT IGNORE INTO wallets (seller_id) VALUES (?)',
                                    [application.user_id],
                                    (walletErr) => {
                                        if (walletErr) return res.status(500).json(walletErr);

                                        createNotification(
                                            application.user_id,
                                            '🎉 Seller Account Approved!',
                                            'Congratulations! Your seller application has been approved. You can now list products, manage orders, and track your earnings from your seller dashboard.',
                                            'system'
                                        ).catch(() => {});

                                        res.json({ message: 'Seller application approved and wallet created' });
                                    }
                                );
                            }
                        );
                    }
                );
            }
        );
    });
};

exports.verifySellerPayment = (req, res) => {
    const adminId = req.user.id;
    const applicationId = req.params.id;
    const status = req.body.status;
    const adminNote = req.body.admin_note ?? req.body.adminNote ?? null;

    if (!['verified', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'Status must be verified or rejected' });
    }

    ensureAdmin(adminId, (authErr) => {
        if (authErr) return res.status(authErr.status).json(authErr.body);

        db.query(
            `SELECT application_id, user_id, application_type, payment_reference, payment_proof_url
             FROM seller_applications
             WHERE application_id = ?`,
            [applicationId],
            (findErr, results) => {
                if (findErr) return res.status(500).json(findErr);
                if (!results.length) return res.status(404).json({ message: 'Seller application not found' });

                const application = results[0];

                if (application.application_type !== 'paid') {
                    return res.status(400).json({ message: 'Only paid applications need payment verification' });
                }

                if (!application.payment_reference && !application.payment_proof_url) {
                    return res.status(400).json({ message: 'This application has no payment reference or uploaded proof to verify' });
                }

                db.query(
                    `UPDATE seller_applications
                     SET payment_status = ?,
                         payment_verified_at = CASE WHEN ? = 'verified' THEN NOW() ELSE NULL END,
                         admin_note = COALESCE(?, admin_note)
                     WHERE application_id = ?`,
                    [status, status, adminNote, applicationId],
                    (updateErr) => {
                        if (updateErr) return res.status(500).json(updateErr);

                        createNotification(
                            application.user_id,
                            'Seller payment reviewed',
                            status === 'verified'
                                ? 'Your store activation payment has been verified. Your application can now move to final approval.'
                                : 'Your store activation payment was rejected. Please contact admin or resubmit correctly.',
                            'system'
                        ).catch(() => {});

                        res.json({
                            message: status === 'verified'
                                ? 'Seller payment verified successfully'
                                : 'Seller payment rejected successfully'
                        });
                    }
                );
            }
        );
    });
};

exports.getProductsForReview = (req, res) => {
    const adminId = req.user.id;

    ensureAdmin(adminId, (authErr) => {
        if (authErr) return res.status(authErr.status).json(authErr.body);

        db.query(
            `SELECT
                p.product_id,
                p.seller_id,
                p.product_name,
                p.description,
                p.price,
                p.image_url,
                p.stock_quantity,
                p.product_status,
                p.approval_status,
                p.admin_note,
                p.created_at,
                u.fullname AS seller_name,
                u.email AS seller_email
            FROM products p
            INNER JOIN users u ON p.seller_id = u.user_id
            ORDER BY p.created_at DESC`,
            (err, results) => {
                if (err) return res.status(500).json(err);
                res.json(results);
            }
        );
    });
};

exports.reviewProduct = (req, res) => {
    const productId = req.params.id;
    const adminId = req.user.id;
    const status = req.body.status;
    const adminNote = req.body.admin_note ?? req.body.adminNote ?? null;

    if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'Status must be approved or rejected' });
    }

    ensureAdmin(adminId, (authErr) => {
        if (authErr) return res.status(authErr.status).json(authErr.body);

        db.query(
            'SELECT product_id, seller_id, product_name FROM products WHERE product_id = ?',
            [productId],
            (findErr, results) => {
                if (findErr) return res.status(500).json(findErr);

                if (results.length === 0) {
                    return res.status(404).json({ message: 'Product not found' });
                }

                const product = results[0];

                db.query(
                    `UPDATE products
                     SET approval_status = ?,
                         admin_note = ?,
                         product_status = CASE WHEN ? = 'rejected' THEN 'inactive' ELSE product_status END
                     WHERE product_id = ?`,
                    [status, adminNote, status, productId],
                    (updateErr) => {
                        if (updateErr) return res.status(500).json(updateErr);

                        createNotification(
                            product.seller_id,
                            status === 'approved' ? 'Product approved' : 'Product rejected',
                            status === 'approved'
                                ? `Your product "${product.product_name}" has been approved and is now eligible for the marketplace feed.`
                                : `Your product "${product.product_name}" has been rejected. Review the admin note and update it before resubmitting.`,
                            'system'
                        ).catch(() => {});

                        res.json({
                            message: status === 'approved'
                                ? 'Product approved successfully'
                                : 'Product rejected successfully'
                        });
                    }
                );
            }
        );
    });
};

exports.getWithdrawalRequests = (req, res) => {
    const adminId = req.user.id;

    ensureAdmin(adminId, (authErr) => {
        if (authErr) return res.status(authErr.status).json(authErr.body);

        db.query(
            `SELECT
                wr.withdrawal_request_id,
                wr.seller_id,
                wr.amount,
                wr.bank_name,
                wr.account_name,
                wr.account_number,
                wr.status,
                wr.admin_note,
                wr.requested_at,
                wr.processed_at,
                u.fullname,
                u.email
            FROM withdrawal_requests wr
            INNER JOIN users u ON wr.seller_id = u.user_id
            ORDER BY wr.requested_at DESC`,
            (err, results) => {
                if (err) return res.status(500).json(err);
                res.json(results);
            }
        );
    });
};

exports.reviewWithdrawalRequest = (req, res) => {
    const adminId = req.user.id;
    const requestId = req.params.id;
    const status = req.body.status;
    const adminNote = req.body.admin_note ?? req.body.adminNote ?? null;

    if (!['approved', 'rejected', 'paid'].includes(status)) {
        return res.status(400).json({ message: 'Status must be approved, rejected, or paid' });
    }

    ensureAdmin(adminId, (authErr) => {
        if (authErr) return res.status(authErr.status).json(authErr.body);

        db.query(
            `SELECT withdrawal_request_id, seller_id, amount, status
             FROM withdrawal_requests
             WHERE withdrawal_request_id = ?`,
            [requestId],
            (findErr, results) => {
                if (findErr) return res.status(500).json(findErr);
                if (!results.length) return res.status(404).json({ message: 'Withdrawal request not found' });

                const request = results[0];

                if (request.status === status) {
                    return res.json({ message: `Withdrawal request already marked as ${status}` });
                }

                if (request.status === 'paid') {
                    return res.status(400).json({ message: 'Paid withdrawal requests cannot be changed' });
                }

                db.query(
                    `UPDATE withdrawal_requests
                     SET status = ?, admin_note = ?, processed_at = NOW()
                     WHERE withdrawal_request_id = ?`,
                    [status, adminNote, requestId],
                    (updateErr) => {
                        if (updateErr) return res.status(500).json(updateErr);

                        const finalize = () => {
                            createNotification(
                                request.seller_id,
                                'Withdrawal updated',
                                `Your withdrawal request #${requestId} is now ${status}.`,
                                'withdrawal'
                            ).catch(() => {});

                            if (status === 'paid') {
                                db.query(
                                    `INSERT INTO transactions
                                    (seller_id, transaction_type, amount, status, reference_code, note)
                                    VALUES (?, 'withdrawal', ?, 'completed', ?, 'Seller withdrawal marked as paid by admin')`,
                                    [request.seller_id, request.amount, `WD-${requestId}`],
                                    () => {}
                                );
                            }

                            return res.json({ message: `Withdrawal request marked as ${status}` });
                        };

                        if (status === 'rejected') {
                            return db.query(
                                `UPDATE wallets
                                 SET available_balance = available_balance + ?,
                                     pending_balance = GREATEST(pending_balance - ?, 0)
                                 WHERE seller_id = ?`,
                                [request.amount, request.amount, request.seller_id],
                                (walletErr) => {
                                    if (walletErr) return res.status(500).json(walletErr);
                                    finalize();
                                }
                            );
                        }

                        if (status === 'paid') {
                            return db.query(
                                `UPDATE wallets
                                 SET pending_balance = GREATEST(pending_balance - ?, 0),
                                     total_withdrawn = total_withdrawn + ?
                                 WHERE seller_id = ?`,
                                [request.amount, request.amount, request.seller_id],
                                (walletErr) => {
                                    if (walletErr) return res.status(500).json(walletErr);
                                    finalize();
                                }
                            );
                        }

                        finalize();
                    }
                );
            }
        );
    });
};

exports.getAnalytics = (req, res) => {
    const adminId = req.user.id;

    ensureAdmin(adminId, (authErr) => {
        if (authErr) return res.status(authErr.status).json(authErr.body);

        db.query(
            `SELECT
                (SELECT COUNT(*) FROM users) AS total_users,
                (SELECT COUNT(*) FROM users WHERE role = 'seller') AS total_sellers,
                (SELECT COUNT(*) FROM users WHERE role = 'buyer') AS total_buyers,
                (SELECT COUNT(*) FROM products WHERE approval_status = 'approved') AS approved_products,
                (SELECT COUNT(*) FROM orders) AS total_orders,
                (SELECT COUNT(*) FROM orders WHERE status = 'delivered') AS delivered_orders,
                (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status IN ('payment_confirmed', 'processing', 'shipped', 'delivered')) AS gross_revenue,
                (SELECT COALESCE(SUM(commission_amount), 0) FROM platform_earnings) AS total_commission,
                (SELECT COALESCE(SUM(amount), 0) FROM withdrawal_requests WHERE status = 'paid') AS paid_withdrawals,
                (SELECT COALESCE(SUM(available_balance), 0) FROM wallets) AS seller_balances`,
            (err, summaryRows) => {
                if (err) return res.status(500).json(err);

                db.query(
                    `SELECT
                        DATE(created_at) AS day,
                        COUNT(*) AS orders_count,
                        COALESCE(SUM(total_amount), 0) AS revenue
                    FROM orders
                    GROUP BY DATE(created_at)
                    ORDER BY day DESC
                    LIMIT 7`,
                    (trendErr, trendRows) => {
                        if (trendErr) return res.status(500).json(trendErr);

                        res.json({
                            summary: summaryRows[0],
                            order_trend: trendRows.reverse()
                        });
                    }
                );
            }
        );
    });
};

exports.getPromoSettings = (req, res) => {
    const adminId = req.user.id;

    ensureAdmin(adminId, (authErr) => {
        if (authErr) return res.status(authErr.status).json(authErr.body);

        db.query(
            `SELECT promo_setting_id, is_active, promo_title, promo_description, promo_questions, updated_at
             FROM promo_settings
             ORDER BY promo_setting_id DESC
             LIMIT 1`,
            (err, results) => {
                if (err) return res.status(500).json(err);

                if (!results.length) {
                    return res.json({
                        is_active: 0,
                        promo_title: 'Free Store Promo',
                        promo_description: '',
                        promo_questions: []
                    });
                }

                const row = results[0];
                let promoQuestions = [];

                try {
                    promoQuestions = JSON.parse(row.promo_questions || '[]');
                } catch (error) {
                    promoQuestions = [];
                }

                res.json({
                    promo_setting_id: row.promo_setting_id,
                    is_active: Number(row.is_active),
                    promo_title: row.promo_title || 'Free Store Promo',
                    promo_description: row.promo_description || '',
                    promo_questions: Array.isArray(promoQuestions) ? promoQuestions : [],
                    updated_at: row.updated_at
                });
            }
        );
    });
};

exports.updatePromoSettings = (req, res) => {
    const adminId = req.user.id;
    const { is_active, promo_title, promo_description, promo_questions } = req.body;

    const questions = Array.isArray(promo_questions)
        ? promo_questions.map((q) => String(q || '').trim()).filter(Boolean)
        : [];

    if (!promo_title?.trim()) {
        return res.status(400).json({ message: 'Promo title is required' });
    }

    ensureAdmin(adminId, (authErr) => {
        if (authErr) return res.status(authErr.status).json(authErr.body);

        db.query(
            `SELECT promo_setting_id, is_active FROM promo_settings ORDER BY promo_setting_id DESC LIMIT 1`,
            (findErr, results) => {
                if (findErr) return res.status(500).json(findErr);

                const payload = [
                    is_active ? 1 : 0,
                    promo_title.trim(),
                    promo_description?.trim() || null,
                    JSON.stringify(questions)
                ];

                const logPayload = [
                    adminId,
                    is_active ? 'activated' : 'updated_questions',
                    promo_title.trim(),
                    promo_description?.trim() || null,
                    JSON.stringify(questions)
                ];

                if (!results.length) {
                    return db.query(
                        `INSERT INTO promo_settings (is_active, promo_title, promo_description, promo_questions)
                         VALUES (?, ?, ?, ?)`,
                        payload,
                        (insertErr) => {
                            if (insertErr) return res.status(500).json(insertErr);
                            db.query(
                                `INSERT INTO promo_logs (admin_user_id, action_type, title_snapshot, description_snapshot, questions_snapshot)
                                 VALUES (?, ?, ?, ?, ?)`,
                                logPayload,
                                () => {}
                            );
                            res.json({ message: 'Promo settings created successfully' });
                        }
                    );
                }

                const previousActive = Number(results[0].is_active || 0);
                const actionType = previousActive !== (is_active ? 1 : 0)
                    ? (is_active ? 'activated' : 'deactivated')
                    : 'updated_questions';

                db.query(
                    `UPDATE promo_settings
                     SET is_active = ?, promo_title = ?, promo_description = ?, promo_questions = ?
                     WHERE promo_setting_id = ?`,
                    [...payload, results[0].promo_setting_id],
                    (updateErr) => {
                        if (updateErr) return res.status(500).json(updateErr);
                        db.query(
                            `INSERT INTO promo_logs (admin_user_id, action_type, title_snapshot, description_snapshot, questions_snapshot)
                             VALUES (?, ?, ?, ?, ?)`,
                            [adminId, actionType, promo_title.trim(), promo_description?.trim() || null, JSON.stringify(questions)],
                            () => {}
                        );
                        res.json({ message: 'Promo settings updated successfully' });
                    }
                );
            }
        );
    });
};

exports.getPromoLogs = (req, res) => {
    const adminId = req.user.id;

    ensureAdmin(adminId, (authErr) => {
        if (authErr) return res.status(authErr.status).json(authErr.body);

        db.query(
            `SELECT
                pl.promo_log_id,
                pl.action_type,
                pl.title_snapshot,
                pl.description_snapshot,
                pl.questions_snapshot,
                pl.created_at,
                u.fullname AS admin_name
            FROM promo_logs pl
            LEFT JOIN users u ON pl.admin_user_id = u.user_id
            ORDER BY pl.created_at DESC
            LIMIT 20`,
            (err, results) => {
                if (err) return res.status(500).json(err);
                res.json(results);
            }
        );
    });
};
