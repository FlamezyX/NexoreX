const fs = require('fs');
const path = require('path');
const db = require('../db');
const { createNotification } = require('../utils/notifications');

const paymentProofDir = path.join(__dirname, '..', 'uploads', 'payment-proofs');

if (!fs.existsSync(paymentProofDir)) {
    fs.mkdirSync(paymentProofDir, { recursive: true });
}

function queryAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });
}

exports.createCheckout = async (req, res) => {
    try {
        const buyerId = req.user.id;
        const { items, shipping_option_id, delivery_address } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Cart items are required' });
        }

        if (!shipping_option_id || !delivery_address?.trim()) {
            return res.status(400).json({ message: 'Shipping option and delivery address are required' });
        }

        const shippingRows = await queryAsync(
            'SELECT shipping_option_id, price FROM shipping_options WHERE shipping_option_id = ? AND is_active = 1',
            [shipping_option_id]
        );

        if (shippingRows.length === 0) {
            return res.status(404).json({ message: 'Shipping option not found' });
        }

        const shippingOption = shippingRows[0];
        const normalizedItems = items.map((item) => ({
            product_id: Number(item.product_id ?? item.productId),
            quantity: Number(item.quantity || 1)
        })).filter((item) => item.product_id && item.quantity > 0);

        if (normalizedItems.length === 0) {
            return res.status(400).json({ message: 'No valid cart items were provided' });
        }

        const productIds = normalizedItems.map((item) => item.product_id);
        const products = await queryAsync(
            `SELECT
                product_id,
                seller_id,
                product_name,
                price,
                stock_quantity,
                approval_status,
                product_status
            FROM products
            WHERE product_id IN (?)`,
            [productIds]
        );

        if (products.length !== normalizedItems.length) {
            return res.status(404).json({ message: 'One or more products could not be found' });
        }

        const productMap = new Map(products.map((product) => [product.product_id, product]));
        const groupedOrders = new Map();

        for (const item of normalizedItems) {
            const product = productMap.get(item.product_id);

            if (!product || product.approval_status !== 'approved' || product.product_status !== 'active') {
                return res.status(400).json({ message: 'One or more products are not available for checkout' });
            }

            if (item.quantity > product.stock_quantity) {
                return res.status(400).json({
                    message: `Insufficient stock for ${product.product_name}`
                });
            }

            const sellerGroup = groupedOrders.get(product.seller_id) || [];
            sellerGroup.push({
                ...item,
                unit_price: Number(product.price),
                product_name: product.product_name
            });
            groupedOrders.set(product.seller_id, sellerGroup);
        }

        const createdOrders = [];

        for (const [sellerId, sellerItems] of groupedOrders.entries()) {
            const subtotalAmount = sellerItems.reduce(
                (sum, item) => sum + (item.unit_price * item.quantity),
                0
            );
            const shippingAmount = Number(shippingOption.price);
            const totalAmount = subtotalAmount + shippingAmount;
            const commissionAmount = Number((subtotalAmount * 0.05).toFixed(2));
            const sellerAmount = Number((subtotalAmount - commissionAmount).toFixed(2));

            const orderResult = await queryAsync(
                `INSERT INTO orders
                (buyer_id, seller_id, shipping_option_id, subtotal_amount, shipping_amount, total_amount, commission_amount, seller_amount, status, delivery_address)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment', ?)`,
                [
                    buyerId,
                    sellerId,
                    shipping_option_id,
                    subtotalAmount,
                    shippingAmount,
                    totalAmount,
                    commissionAmount,
                    sellerAmount,
                    delivery_address.trim()
                ]
            );

            const orderId = orderResult.insertId;

            for (const item of sellerItems) {
                await queryAsync(
                    `INSERT INTO order_items
                    (order_id, product_id, quantity, unit_price, total_price)
                    VALUES (?, ?, ?, ?, ?)`,
                    [
                        orderId,
                        item.product_id,
                        item.quantity,
                        item.unit_price,
                        Number((item.unit_price * item.quantity).toFixed(2))
                    ]
                );

                await queryAsync(
                    'UPDATE products SET stock_quantity = stock_quantity - ? WHERE product_id = ?',
                    [item.quantity, item.product_id]
                );
            }

            createdOrders.push({
                order_id: orderId,
                seller_id: sellerId,
                total_amount: totalAmount,
                status: 'pending_payment'
            });
        }

        res.status(201).json({
            message: 'Checkout created successfully',
            orders: createdOrders
        });

        for (const createdOrder of createdOrders) {
            await createNotification(
                buyerId,
                'Order created',
                `Order #${createdOrder.order_id} has been created and is awaiting payment confirmation.`,
                'order'
            );

            await createNotification(
                createdOrder.seller_id,
                'New order received',
                `A new order #${createdOrder.order_id} has been placed and is waiting for buyer payment.`,
                'order'
            );
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getMyOrders = async (req, res) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;

        let sql = `SELECT
            order_id,
            buyer_id,
            seller_id,
            shipping_option_id,
            subtotal_amount,
            shipping_amount,
            total_amount,
            commission_amount,
            seller_amount,
            status,
            payment_reference,
            payment_proof_url,
            admin_note,
            delivery_address,
            created_at,
            updated_at
        FROM orders`;
        let params = [];

        if (role === 'buyer') {
            sql += ' WHERE buyer_id = ?';
            params = [userId];
        } else if (role === 'seller') {
            sql += ' WHERE seller_id = ?';
            params = [userId];
        }

        sql += ' ORDER BY created_at DESC';
        const orders = await queryAsync(sql, params);

        for (const order of orders) {
            order.items = await queryAsync(
                `SELECT
                    oi.order_item_id,
                    oi.product_id,
                    oi.quantity,
                    oi.unit_price,
                    oi.total_price,
                    p.product_name,
                    r.review_id,
                    r.rating AS review_rating,
                    r.comment AS review_comment
                FROM order_items oi
                INNER JOIN products p ON oi.product_id = p.product_id
                LEFT JOIN reviews r
                    ON r.order_id = oi.order_id
                    AND r.product_id = oi.product_id
                    AND r.buyer_id = ?
                WHERE oi.order_id = ?`,
                [userId, order.order_id]
            );
        }

        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.submitPaymentProof = async (req, res) => {
    try {
        const buyerId = req.user.id;
        const orderId = req.params.id;
        const {
            payment_reference,
            payment_proof_url,
            payment_proof_name,
            payment_proof_data
        } = req.body;

        if (!payment_reference?.trim()) {
            return res.status(400).json({ message: 'Payment reference is required' });
        }

        const orders = await queryAsync(
            'SELECT order_id, buyer_id, status FROM orders WHERE order_id = ?',
            [orderId]
        );

        if (orders.length === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const order = orders[0];

        if (order.buyer_id !== buyerId) {
            return res.status(403).json({ message: 'You can only submit payment for your own order' });
        }

        if (!['pending_payment', 'payment_uploaded'].includes(order.status)) {
            return res.status(400).json({ message: 'This order can no longer accept payment proof' });
        }

        let paymentProofUrl = payment_proof_url?.trim() || null;

        if (payment_proof_data) {
            const match = String(payment_proof_data).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

            if (!match) {
                return res.status(400).json({ message: 'Payment proof must be a valid image file' });
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
                return res.status(400).json({ message: 'Only JPG, PNG, or WEBP payment proof images are allowed' });
            }

            if (match[2].length > 5 * 1024 * 1024 * 1.4) {
                return res.status(400).json({ message: 'Payment proof image must be 5MB or smaller' });
            }

            const fileBuffer = Buffer.from(match[2], 'base64');

            if (fileBuffer.length > 5 * 1024 * 1024) {
                return res.status(400).json({ message: 'Payment proof image must be 5MB or smaller' });
            }

            const safeBaseName = String(payment_proof_name || 'payment-proof')
                .replace(/[^a-zA-Z0-9._-]/g, '-')
                .replace(/\.+/g, '.')
                .slice(0, 60);
            const finalFileName = `order-${orderId}-${Date.now()}-${safeBaseName || 'proof'}.${extension}`;
            const filePath = path.resolve(paymentProofDir, finalFileName);

            const resolvedPath = path.normalize(filePath);

            if (!resolvedPath.startsWith(path.resolve(paymentProofDir) + path.sep)) {
                return res.status(400).json({ message: 'Invalid file path' });
            }

            fs.writeFileSync(resolvedPath, fileBuffer);
            paymentProofUrl = `/uploads/payment-proofs/${finalFileName}`;
        }

        await queryAsync(
            `UPDATE orders
             SET payment_reference = ?,
                 payment_proof_url = ?,
                 status = 'payment_uploaded'
             WHERE order_id = ?`,
            [payment_reference.trim(), paymentProofUrl, orderId]
        );

        await createNotification(
            buyerId,
            'Payment proof submitted',
            `Payment proof for order #${orderId} was uploaded successfully and is awaiting admin review.`,
            'payment'
        );

        res.json({ message: 'Payment proof submitted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateSellerOrderStatus = async (req, res) => {
    try {
        const sellerId = req.user.id;
        const orderId = req.params.id;
        const { status } = req.body;
        const allowedTransitions = {
            payment_confirmed: ['processing'],
            processing: ['shipped'],
            shipped: ['delivered']
        };

        if (!status || !['processing', 'shipped', 'delivered'].includes(status)) {
            return res.status(400).json({ message: 'Status must be processing, shipped, or delivered' });
        }

        const orders = await queryAsync(
            'SELECT order_id, seller_id, buyer_id, status FROM orders WHERE order_id = ?',
            [orderId]
        );

        if (orders.length === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const order = orders[0];

        if (order.seller_id !== sellerId) {
            return res.status(403).json({ message: 'You can only manage your own orders' });
        }

        const nextStatuses = allowedTransitions[order.status] || [];

        if (!nextStatuses.includes(status)) {
            return res.status(400).json({
                message: `This order cannot move from ${order.status} to ${status}`
            });
        }

        await queryAsync(
            'UPDATE orders SET status = ?, delivered_at = ? WHERE order_id = ?',
            [status, status === 'delivered' ? new Date() : null, orderId]
        );

        await createNotification(
            order.buyer_id,
            'Order updated',
            `Order #${orderId} was updated to ${status}.`,
            'order'
        );

        await createNotification(
            sellerId,
            'Order status updated',
            `You updated order #${orderId} to ${status}.`,
            'order'
        );

        res.json({ message: `Order moved to ${status} successfully` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.cancelOrder = async (req, res) => {
    try {
        const buyerId = req.user.id;
        const orderId = req.params.id;

        const orders = await queryAsync(
            `SELECT order_id, buyer_id, seller_id, status, seller_amount FROM orders WHERE order_id = ?`,
            [orderId]
        );

        if (!orders.length) return res.status(404).json({ message: 'Order not found' });
        const order = orders[0];

        if (order.buyer_id !== buyerId) {
            return res.status(403).json({ message: 'You can only cancel your own orders' });
        }

        if (!['pending_payment', 'payment_uploaded'].includes(order.status)) {
            return res.status(400).json({ message: 'Only orders that have not been payment-confirmed can be cancelled' });
        }

        await queryAsync(`UPDATE orders SET status = 'cancelled' WHERE order_id = ?`, [orderId]);

        // Restore stock
        const items = await queryAsync(`SELECT product_id, quantity FROM order_items WHERE order_id = ?`, [orderId]);
        for (const item of items) {
            await queryAsync(
                'UPDATE products SET stock_quantity = stock_quantity + ? WHERE product_id = ?',
                [item.quantity, item.product_id]
            );
        }

        await createNotification(buyerId, 'Order cancelled', `Order #${orderId} has been cancelled successfully.`, 'order');
        await createNotification(order.seller_id, 'Order cancelled', `Order #${orderId} was cancelled by the buyer.`, 'order');

        res.json({ message: 'Order cancelled successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.confirmPayment = async (req, res) => {
    try {
        const orderId = req.params.id;
        const orders = await queryAsync(
            `SELECT order_id, seller_id, buyer_id, status, subtotal_amount,
             total_amount, commission_amount, seller_amount, payment_reference
             FROM orders WHERE order_id = ?`,
            [orderId]
        );

        if (orders.length === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const order = orders[0];

        if (!['payment_uploaded', 'pending_payment'].includes(order.status)) {
            return res.status(400).json({ message: 'Order payment has already been processed' });
        }

        await queryAsync(
            `UPDATE orders
             SET status = 'payment_confirmed'
             WHERE order_id = ?`,
            [orderId]
        );

        await queryAsync(
            'INSERT IGNORE INTO wallets (seller_id) VALUES (?)',
            [order.seller_id]
        );

        await queryAsync(
            `UPDATE wallets
             SET total_earned = total_earned + ?,
                 available_balance = available_balance + ?
             WHERE seller_id = ?`,
            [order.seller_amount, order.seller_amount, order.seller_id]
        );

        await queryAsync(
            `INSERT INTO transactions
            (order_id, seller_id, buyer_id, transaction_type, amount, status, reference_code, note)
            VALUES
            (?, ?, ?, 'payment', ?, 'completed', ?, 'Buyer payment confirmed by admin'),
            (?, ?, ?, 'commission', ?, 'completed', ?, 'Platform commission captured'),
            (?, ?, ?, 'wallet_credit', ?, 'completed', ?, 'Seller wallet credited after payment confirmation')`,
            [
                order.order_id, order.seller_id, order.buyer_id, order.total_amount, order.payment_reference || `PAY-${order.order_id}`,
                order.order_id, order.seller_id, order.buyer_id, order.commission_amount, `COM-${order.order_id}`,
                order.order_id, order.seller_id, order.buyer_id, order.seller_amount, `WAL-${order.order_id}`
            ]
        );

        await queryAsync(
            `INSERT INTO platform_earnings
            (order_id, commission_rate, gross_amount, commission_amount, seller_amount)
            VALUES (?, 5.00, ?, ?, ?)`,
            [order.order_id, order.subtotal_amount, order.commission_amount, order.seller_amount]
        );

        await createNotification(
            order.buyer_id,
            'Payment confirmed',
            `Admin confirmed payment for order #${order.order_id}. The seller can now begin fulfillment.`,
            'payment'
        );

        await createNotification(
            order.seller_id,
            'Payment confirmed',
            `Payment for order #${order.order_id} has been confirmed. Your wallet has been credited.`,
            'payment'
        );

        res.json({ message: 'Payment confirmed and seller wallet credited successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
