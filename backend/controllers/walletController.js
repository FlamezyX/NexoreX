const db = require('../db');
const { createNotification } = require('../utils/notifications');

function formatNGN(value) {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(value);
}

function queryAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });
}

exports.getMyWallet = async (req, res) => {
    try {
        const sellerId = req.user.id;

        await queryAsync('INSERT IGNORE INTO wallets (seller_id) VALUES (?)', [sellerId]);

        const wallets = await queryAsync(
            `SELECT
                wallet_id,
                seller_id,
                total_earned,
                available_balance,
                pending_balance,
                total_withdrawn,
                updated_at
            FROM wallets
            WHERE seller_id = ?`,
            [sellerId]
        );

        const transactions = await queryAsync(
            `SELECT
                transaction_id,
                order_id,
                transaction_type,
                amount,
                status,
                reference_code,
                note,
                created_at
            FROM transactions
            WHERE seller_id = ?
            ORDER BY created_at DESC
            LIMIT 10`,
            [sellerId]
        );

        const withdrawals = await queryAsync(
            `SELECT
                withdrawal_request_id,
                amount,
                bank_name,
                account_name,
                account_number,
                status,
                admin_note,
                requested_at,
                processed_at
            FROM withdrawal_requests
            WHERE seller_id = ?
            ORDER BY requested_at DESC`,
            [sellerId]
        );

        res.json({
            wallet: wallets[0] || null,
            transactions,
            withdrawals
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.requestWithdrawal = async (req, res) => {
    try {
        const sellerId = req.user.id;
        const { amount, bank_name, account_name, account_number } = req.body;

        const numericAmount = Number(amount);
        if (Number.isNaN(numericAmount) || numericAmount <= 0) {
            return res.status(400).json({ message: 'Withdrawal amount must be greater than zero' });
        }
        if (!bank_name?.trim() || !account_name?.trim() || !account_number?.trim()) {
            return res.status(400).json({ message: 'Bank name, account name, and account number are required' });
        }

        // Get hold period and minimum withdrawal from platform settings
        const settingRows = await queryAsync(
            `SELECT setting_key, setting_value FROM platform_settings WHERE setting_key IN ('withdrawal_hold_hours', 'min_withdrawal_amount')`
        );
        const settings = Object.fromEntries(settingRows.map(r => [r.setting_key, r.setting_value]));
        const holdHours = Number(settings.withdrawal_hold_hours || 24);
        const minAmount = Number(settings.min_withdrawal_amount || 1000);

        if (numericAmount < minAmount) {
            return res.status(400).json({ message: `Minimum withdrawal amount is ${formatNGN(minAmount)}` });
        }

        // Check if seller has any delivered orders still within the hold period
        const heldOrders = await queryAsync(
            `SELECT order_id, delivered_at FROM orders
             WHERE seller_id = ?
               AND status = 'delivered'
               AND delivered_at IS NOT NULL
               AND delivered_at > DATE_SUB(NOW(), INTERVAL ? HOUR)`,
            [sellerId, holdHours]
        );

        if (heldOrders.length > 0) {
            const earliest = heldOrders.reduce((a, b) =>
                new Date(a.delivered_at) < new Date(b.delivered_at) ? a : b
            );
            const releaseTime = new Date(new Date(earliest.delivered_at).getTime() + holdHours * 3600000);
            const releaseStr = releaseTime.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
            return res.status(400).json({
                message: `Your funds are still within the ${holdHours}-hour hold period. Earliest withdrawal available at ${releaseStr}.`
            });
        }

        // Check for undelivered orders (payment confirmed but not yet delivered)
        const undeliveredOrders = await queryAsync(
            `SELECT order_id FROM orders
             WHERE seller_id = ?
               AND status IN ('payment_confirmed', 'processing', 'shipped')`,
            [sellerId]
        );

        if (undeliveredOrders.length > 0) {
            return res.status(400).json({
                message: `You have ${undeliveredOrders.length} order(s) that have not been delivered yet. Complete all active orders before requesting a withdrawal.`
            });
        }

        await queryAsync('INSERT IGNORE INTO wallets (seller_id) VALUES (?)', [sellerId]);
        const wallets = await queryAsync(
            'SELECT wallet_id, available_balance FROM wallets WHERE seller_id = ?',
            [sellerId]
        );
        if (!wallets.length) return res.status(404).json({ message: 'Wallet not found' });

        const wallet = wallets[0];
        if (numericAmount > Number(wallet.available_balance)) {
            return res.status(400).json({ message: 'Withdrawal amount exceeds available balance' });
        }

        const pendingRequests = await queryAsync(
            `SELECT withdrawal_request_id FROM withdrawal_requests WHERE seller_id = ? AND status = 'pending'`,
            [sellerId]
        );
        if (pendingRequests.length > 0) {
            return res.status(400).json({ message: 'You already have a pending withdrawal request' });
        }

        await queryAsync(
            `UPDATE wallets SET available_balance = available_balance - ?, pending_balance = pending_balance + ? WHERE seller_id = ?`,
            [numericAmount, numericAmount, sellerId]
        );

        const result = await queryAsync(
            `INSERT INTO withdrawal_requests (seller_id, amount, bank_name, account_name, account_number, status)
             VALUES (?, ?, ?, ?, ?, 'pending')`,
            [sellerId, numericAmount, bank_name.trim(), account_name.trim(), account_number.trim()]
        );

        await createNotification(
            sellerId,
            'Withdrawal requested',
            `Your withdrawal request of NGN ${numericAmount.toFixed(2)} is now pending admin review.`,
            'withdrawal'
        );

        res.status(201).json({
            message: 'Withdrawal request submitted successfully',
            withdrawal_request_id: result.insertId
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
