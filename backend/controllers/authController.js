'use strict';

const fs = require('fs');
const path = require('path');
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { createNotification } = require('../utils/notifications');

const sellerPaymentProofDir = path.join(__dirname, '..', 'uploads', 'seller-payment-proofs');

if (!fs.existsSync(sellerPaymentProofDir)) {
    fs.mkdirSync(sellerPaymentProofDir, { recursive: true });
}

function queryAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });
}

function saveSellerPaymentProof({ userId, paymentProofData, paymentProofName }) {
    if (!paymentProofData) {
        return null;
    }

    const match = String(paymentProofData).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

    if (!match) {
        throw new Error('Seller payment proof must be a valid image file');
    }

    const mimeType = match[1].toLowerCase();
    const allowedTypes = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp'
    };

    const extension = allowedTypes[mimeType];

    if (!extension) {
        throw new Error('Only JPG, PNG, or WEBP seller payment proof images are allowed');
    }

    const fileBuffer = Buffer.from(match[2], 'base64');

    if (fileBuffer.length > 5 * 1024 * 1024) {
        throw new Error('Seller payment proof image must be 5MB or smaller');
    }

    const safeBaseName = String(paymentProofName || 'seller-payment-proof')
        .replace(/[^a-zA-Z0-9._-]/g, '-')
        .replace(/\.+/g, '.')
        .slice(0, 60);
    const finalFileName = `seller-${userId}-${Date.now()}-${safeBaseName || 'proof'}.${extension}`;
    const resolvedPath = path.normalize(path.resolve(sellerPaymentProofDir, finalFileName));

    if (!resolvedPath.startsWith(path.resolve(sellerPaymentProofDir) + path.sep)) {
        throw new Error('Invalid file path');
    }

    fs.writeFileSync(resolvedPath, fileBuffer);
    return `/uploads/seller-payment-proofs/${finalFileName}`;
}

exports.register = (req, res) => {
    const { name, email, password, role } = req.body;
    const normalizedEmail = email ? email.trim().toLowerCase() : '';
    const requestedRole = role === 'seller' ? 'seller' : 'buyer';

    if (!name || !normalizedEmail || !password) {
        return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    if (!/^[^ \t\r\n\f\v@]+@[^ \t\r\n\f\v@]+\.[^ \t\r\n\f\v@]+$/.test(normalizedEmail)) {
        return res.status(400).json({ message: 'Please enter a valid email address' });
    }

    if (password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

    db.query(
        'SELECT user_id FROM users WHERE email = ?',
        [normalizedEmail],
        (checkErr, existingUsers) => {
            if (checkErr) return res.status(500).json(checkErr);

            if (existingUsers.length > 0) {
                return res.status(409).json({ message: 'An account with this email already exists' });
            }

            const hashedPassword = bcrypt.hashSync(password, 10);

            db.query(
                'INSERT INTO users (fullname, email, password, role, account_status, seller_status) VALUES (?, ?, ?, ?, ?, ?)',
                [
                    name.trim(),
                    normalizedEmail,
                    hashedPassword,
                    requestedRole,
                    'active',
                    requestedRole === 'seller' ? 'pending' : 'not_applied'
                ],
                (err, result) => {
                    if (err) return res.status(500).json(err);

                    if (requestedRole === 'seller') {
                        createNotification(
                            result.insertId,
                            '🎉 Welcome to NexoreX!',
                            'Congratulations on registering as a seller! Complete your seller application from your dashboard and our team will review and approve your store.',
                            'system'
                        ).catch(() => {});
                    }

                    res.status(201).json({
                        message: requestedRole === 'seller'
                            ? 'Seller account created. Complete your seller application after login.'
                            : 'User registered successfully'
                    });
                }
            );
        }
    );
};

exports.applySeller = (req, res) => {
    (async () => {
    const user_id = req.user.id;
    const {
        business_name,
        business_description,
        phone,
        location,
        application_type,
        payment_reference,
        payment_proof_url,
        payment_proof_name,
        payment_proof_data,
        promo_answers,
        terms_accepted
    } = req.body;
    const applicationType = application_type === 'promo' ? 'promo' : 'paid';
    const normalizedPromoAnswers = Array.isArray(promo_answers)
        ? promo_answers.map((answer) => String(answer || '').trim()).filter(Boolean)
        : [];
    const normalizedPaymentReference = payment_reference?.trim() || '';
    const normalizedPaymentProofUrl = payment_proof_url?.trim() || '';

    if (!user_id || !business_name) {
        return res.status(400).json({ message: 'User ID and business name are required' });
    }

    if (!terms_accepted) {
        return res.status(400).json({ message: 'You must accept the Terms and Conditions to proceed' });
    }

    if (applicationType === 'paid' && !normalizedPaymentReference && !normalizedPaymentProofUrl && !payment_proof_data) {
        return res.status(400).json({ message: 'Add a payment reference or upload payment proof for the paid store activation path' });
    }

    if (applicationType === 'promo' && normalizedPromoAnswers.length < 3) {
        return res.status(400).json({ message: 'Please answer all promo questions to apply for a free store' });
    }

    if (applicationType === 'promo') {
        const promoRows = await queryAsync(
            `SELECT is_active, promo_questions FROM promo_settings ORDER BY promo_setting_id DESC LIMIT 1`
        ).catch((error) => { throw error; });

        const promo = promoRows[0];

        if (!promo || Number(promo.is_active) !== 1) {
            return res.status(400).json({ message: 'The free-store promo is not active right now' });
        }

        try {
            const configuredQuestions = JSON.parse(promo.promo_questions || '[]');
            if (Array.isArray(configuredQuestions) && configuredQuestions.length > 0 && normalizedPromoAnswers.length < configuredQuestions.length) {
                return res.status(400).json({ message: 'Please answer all active promo questions before submitting' });
            }
        } catch (error) {
            return res.status(400).json({ message: 'Promo questions are not configured correctly yet' });
        }
    }

    let savedPaymentProofUrl = null;

    if (applicationType === 'paid' && payment_proof_data) {
        try {
            savedPaymentProofUrl = saveSellerPaymentProof({
                userId: user_id,
                paymentProofData: payment_proof_data,
                paymentProofName: payment_proof_name
            });
        } catch (error) {
            return res.status(400).json({ message: error.message });
        }
    }

    db.query(
        'SELECT user_id, role, seller_status FROM users WHERE user_id = ?',
        [user_id],
        (userErr, userResults) => {
            if (userErr) return res.status(500).json(userErr);

            if (userResults.length === 0) {
                return res.status(404).json({ message: 'User not found' });
            }

            const user = userResults[0];

            if (user.role !== 'seller') {
                return res.status(400).json({ message: 'Only seller accounts can submit seller applications' });
            }

            db.query(
                'SELECT application_id, status FROM seller_applications WHERE user_id = ? ORDER BY application_id DESC LIMIT 1',
                [user_id],
                (applicationErr, applicationResults) => {
                    if (applicationErr) return res.status(500).json(applicationErr);

                    if (applicationResults.length > 0 && applicationResults[0].status === 'pending') {
                        return res.status(409).json({ message: 'A seller application is already pending for this account' });
                    }

                    db.query(
                        `INSERT INTO seller_applications
                        (user_id, business_name, business_description, phone, location, application_type,
                        store_fee_amount, payment_status, payment_reference, payment_proof_url,
                        promo_status, promo_answers, status, terms_accepted_at)
                        VALUES (?, ?, ?, ?, ?, ?, 3000.00, ?, ?, ?, ?, ?, 'pending', NOW())`,
                        [
                            user_id,
                            business_name.trim(),
                            business_description?.trim() || null,
                            phone?.trim() || null,
                            location?.trim() || null,
                            applicationType,
                            applicationType === 'paid' ? 'submitted' : 'not_required',
                            applicationType === 'paid' ? normalizedPaymentReference || null : null,
                            applicationType === 'paid' ? savedPaymentProofUrl || normalizedPaymentProofUrl || null : null,
                            applicationType === 'promo' ? 'pending' : 'not_applied',
                            applicationType === 'promo' ? JSON.stringify(normalizedPromoAnswers) : null
                        ],
                        (insertErr) => {
                            if (insertErr) return res.status(500).json(insertErr);

                            db.query(
                                `UPDATE users SET seller_status = 'pending',
                                 phone = COALESCE(?, phone), location = COALESCE(?, location)
                                 WHERE user_id = ?`,
                                [phone?.trim() || null, location?.trim() || null, user_id],
                                (updateErr) => {
                                    if (updateErr) return res.status(500).json(updateErr);
                                    res.status(201).json({
                                        message: applicationType === 'paid'
                                            ? 'Seller application submitted with store activation payment details'
                                            : 'Promo seller application submitted successfully'
                                    });
                                }
                            );
                        }
                    );
                }
            );
        }
    );
    })().catch((error) => {
        res.status(500).json({ message: error.message });
    });
};

exports.getPromoSettings = async (req, res) => {
    try {
        const rows = await queryAsync(
            `SELECT is_active, promo_title, promo_description, promo_questions, updated_at
             FROM promo_settings ORDER BY promo_setting_id DESC LIMIT 1`
        );

        if (!rows.length) {
            return res.json({ is_active: 0, promo_title: 'Free Store Promo', promo_description: '', promo_questions: [] });
        }

        const promo = rows[0];
        let questions = [];

        try {
            questions = JSON.parse(promo.promo_questions || '[]');
        } catch (error) {
            questions = [];
        }

        res.json({
            is_active: Number(promo.is_active),
            promo_title: promo.promo_title || 'Free Store Promo',
            promo_description: promo.promo_description || '',
            promo_questions: Array.isArray(questions) ? questions : [],
            updated_at: promo.updated_at
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
    const email = req.body.email?.trim().toLowerCase();
    if (!email) return res.status(400).json({ message: 'Email is required' });
    try {
        const users = await queryAsync('SELECT user_id FROM users WHERE email = ?', [email]);
        if (!users.length) return res.json({ message: 'If that email exists, a reset link has been sent.' });

        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 60 * 60 * 1000);

        await queryAsync(
            `INSERT INTO password_resets (user_id, token, expires_at, used)
             VALUES (?, ?, ?, 0)
             ON DUPLICATE KEY UPDATE token = VALUES(token), expires_at = VALUES(expires_at), used = 0`,
            [users[0].user_id, token, expires]
        );

        if (process.env.NODE_ENV !== 'production') {
            console.log(`[Password Reset] Link for ${email}: ${process.env.FRONTEND_URL || 'http://localhost:5500'}/reset-password.html?token=${token}`);
        }

        res.json({ message: 'If that email exists, a reset link has been sent.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/auth/reset-password
exports.resetPassword = async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ message: 'Token and new password are required' });
    if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });
    try {
        const rows = await queryAsync(
            `SELECT user_id FROM password_resets WHERE token = ? AND used = 0 AND expires_at > NOW()`,
            [token]
        );
        if (!rows.length) return res.status(400).json({ message: 'This reset link is invalid or has expired' });

        const hashed = bcrypt.hashSync(password, 10);
        await queryAsync('UPDATE users SET password = ? WHERE user_id = ?', [hashed, rows[0].user_id]);
        await queryAsync('UPDATE password_resets SET used = 1 WHERE token = ?', [token]);
        res.json({ message: 'Password updated successfully. You can now log in.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.login = (req, res) => {
    const { email, password } = req.body;
    const normalizedEmail = email ? email.trim().toLowerCase() : '';

    if (!normalizedEmail || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    db.query(
        'SELECT * FROM users WHERE email = ?',
        [normalizedEmail],
        (err, results) => {
            if (err) return res.status(500).json(err);

            if (results.length === 0) {
                return res.status(404).json({ message: 'User not found' });
            }

            const user = results[0];
            const isMatch = bcrypt.compareSync(password, user.password);

            if (!isMatch) {
                return res.status(401).json({ message: 'Wrong password' });
            }

            const token = jwt.sign(
                { id: user.user_id, email: user.email, role: user.role, admin_level: user.admin_level || null },
                process.env.JWT_SECRET,
                { expiresIn: '1d' }
            );

            res.json({
                token,
                user: {
                    id: user.user_id,
                    name: user.fullname,
                    email: user.email,
                    role: user.role,
                    adminLevel: user.admin_level || null,
                    accountStatus: user.account_status,
                    sellerStatus: user.seller_status,
                    phone: user.phone,
                    location: user.location
                }
            });
        }
    );
};
