const db = require('../db');
const { createNotification } = require('../utils/notifications');

function queryAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });
}

exports.createReview = async (req, res) => {
    try {
        const buyerId = req.user.id;
        const {
            order_id,
            product_id,
            rating,
            comment
        } = req.body;

        const numericRating = Number(rating);

        if (!order_id || !product_id || !Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
            return res.status(400).json({ message: 'Order, product, and a rating from 1 to 5 are required' });
        }

        const orderRows = await queryAsync(
            `SELECT
                o.order_id,
                o.buyer_id,
                o.seller_id,
                o.status,
                oi.product_id
            FROM orders o
            INNER JOIN order_items oi ON o.order_id = oi.order_id
            WHERE o.order_id = ? AND oi.product_id = ?`,
            [order_id, product_id]
        );

        if (!orderRows.length) {
            return res.status(404).json({ message: 'Delivered order item not found' });
        }

        const order = orderRows[0];

        if (order.buyer_id !== buyerId) {
            return res.status(403).json({ message: 'You can only review your own delivered orders' });
        }

        if (order.status !== 'delivered') {
            return res.status(400).json({ message: 'Reviews can only be submitted after delivery' });
        }

        const existingReview = await queryAsync(
            'SELECT review_id FROM reviews WHERE order_id = ? AND product_id = ? AND buyer_id = ?',
            [order_id, product_id, buyerId]
        );

        if (existingReview.length) {
            return res.status(400).json({ message: 'You already reviewed this product for this order' });
        }

        await queryAsync(
            `INSERT INTO reviews
            (order_id, product_id, buyer_id, seller_id, rating, comment, review_status)
            VALUES (?, ?, ?, ?, ?, ?, 'published')`,
            [
                order_id,
                product_id,
                buyerId,
                order.seller_id,
                numericRating,
                comment?.trim() || null
            ]
        );

        await createNotification(
            order.seller_id,
            'New buyer review',
            `A buyer left a ${numericRating}-star review on order #${order_id}.`,
            'system'
        );

        res.status(201).json({ message: 'Review submitted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getProductReviews = async (req, res) => {
    try {
        const productId = req.params.productId;
        const reviews = await queryAsync(
            `SELECT
                r.review_id,
                r.rating,
                r.comment,
                r.review_status,
                r.created_at,
                u.fullname AS buyer_name
            FROM reviews r
            INNER JOIN users u ON r.buyer_id = u.user_id
            WHERE r.product_id = ? AND r.review_status = 'published'
            ORDER BY r.created_at DESC`,
            [productId]
        );

        res.json(reviews);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getReviewsForModeration = async (req, res) => {
    try {
        const reviews = await queryAsync(
            `SELECT
                r.review_id,
                r.order_id,
                r.product_id,
                r.seller_id,
                r.rating,
                r.comment,
                r.review_status,
                r.admin_note,
                r.moderated_at,
                r.created_at,
                p.product_name,
                buyer.fullname AS buyer_name,
                seller.fullname AS seller_name
            FROM reviews r
            INNER JOIN products p ON r.product_id = p.product_id
            INNER JOIN users buyer ON r.buyer_id = buyer.user_id
            INNER JOIN users seller ON r.seller_id = seller.user_id
            ORDER BY r.created_at DESC`
        );

        res.json(reviews);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.moderateReview = async (req, res) => {
    try {
        const reviewId = req.params.id;
        const { status, admin_note } = req.body;

        if (!['published', 'hidden', 'flagged'].includes(status)) {
            return res.status(400).json({ message: 'Status must be published, hidden, or flagged' });
        }

        const reviewRows = await queryAsync(
            'SELECT review_id, seller_id, product_id FROM reviews WHERE review_id = ?',
            [reviewId]
        );

        if (!reviewRows.length) {
            return res.status(404).json({ message: 'Review not found' });
        }

        const review = reviewRows[0];

        await queryAsync(
            `UPDATE reviews
             SET review_status = ?,
                 admin_note = ?,
                 moderated_at = NOW()
             WHERE review_id = ?`,
            [status, admin_note?.trim() || null, reviewId]
        );

        await createNotification(
            review.seller_id,
            'Review moderation update',
            `A review connected to product #${review.product_id} was updated to ${status} by admin.`,
            'system'
        );

        res.json({ message: `Review marked as ${status}` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
