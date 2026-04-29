'use strict';

const fs = require('fs');
const path = require('path');
const db = require('../db');
const { createNotification } = require('../utils/notifications');

const postImagesDir = path.join(__dirname, '..', 'uploads', 'post-images');
if (!fs.existsSync(postImagesDir)) fs.mkdirSync(postImagesDir, { recursive: true });

function queryAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });
}

// POST /api/posts — seller creates a post
exports.createPost = async (req, res) => {
    try {
        const sellerId = req.user.id;
        const { caption, product_id, image_data, image_name } = req.body;

        if (!caption?.trim()) return res.status(400).json({ message: 'Caption is required' });

        // Verify seller is approved
        const sellers = await queryAsync(
            `SELECT seller_status FROM users WHERE user_id = ? AND role = 'seller'`,
            [sellerId]
        );
        if (!sellers.length || sellers[0].seller_status !== 'approved') {
            return res.status(403).json({ message: 'Only approved sellers can create posts' });
        }

        let imageUrl = null;

        if (image_data) {
            const match = String(image_data).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
            if (!match) return res.status(400).json({ message: 'Invalid image format' });
            const allowed = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
            const ext = allowed[match[1].toLowerCase()];
            if (!ext) return res.status(400).json({ message: 'Only JPG, PNG or WEBP allowed' });
            const buffer = Buffer.from(match[2], 'base64');
            if (buffer.length > 5 * 1024 * 1024) return res.status(400).json({ message: 'Image must be under 5MB' });
            const safeName = String(image_name || 'post').replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 50);
            const fileName = `post-${sellerId}-${Date.now()}-${safeName}.${ext}`;
            fs.writeFileSync(path.join(postImagesDir, fileName), buffer);
            imageUrl = `/uploads/post-images/${fileName}`;
        }

        const result = await queryAsync(
            `INSERT INTO posts (seller_id, caption, image_url, product_id, status) VALUES (?, ?, ?, ?, 'approved')`,
            [sellerId, caption.trim(), imageUrl, product_id || null]
        );

        res.status(201).json({ message: 'Post published successfully', post_id: result.insertId });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/posts — public feed of approved posts
exports.getFeed = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(20, parseInt(req.query.limit) || 10);
        const offset = (page - 1) * limit;
        const userId = req.user?.id || null;

        const countRows = await queryAsync(
            `SELECT COUNT(*) AS total FROM posts WHERE status = 'approved'`
        );
        const total = countRows[0]?.total || 0;

        const posts = await queryAsync(
            `SELECT
                p.post_id, p.caption, p.image_url, p.like_count, p.created_at,
                p.product_id,
                u.user_id AS seller_id, u.fullname AS seller_name,
                pr.product_name, pr.price, pr.image_url AS product_image,
                ${userId ? `(SELECT COUNT(*) FROM post_likes WHERE post_id = p.post_id AND user_id = ?) AS liked_by_me` : '0 AS liked_by_me'}
            FROM posts p
            INNER JOIN users u ON p.seller_id = u.user_id
            LEFT JOIN products pr ON p.product_id = pr.product_id
            WHERE p.status = 'approved'
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?`,
            userId ? [userId, limit, offset] : [limit, offset]
        );

        res.json({
            posts,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/posts/my — seller's own posts
exports.getMyPosts = async (req, res) => {
    try {
        const sellerId = req.user.id;
        const posts = await queryAsync(
            `SELECT p.post_id, p.caption, p.image_url, p.status, p.admin_note,
                    p.like_count, p.created_at, p.product_id, pr.product_name
             FROM posts p
             LEFT JOIN products pr ON p.product_id = pr.product_id
             WHERE p.seller_id = ?
             ORDER BY p.created_at DESC`,
            [sellerId]
        );
        res.json(posts);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/posts/admin — all posts for admin review
exports.getAdminPosts = async (req, res) => {
    try {
        const status = req.query.status || 'pending';
        const posts = await queryAsync(
            `SELECT p.post_id, p.caption, p.image_url, p.status, p.admin_note,
                    p.like_count, p.created_at, p.product_id,
                    u.fullname AS seller_name, u.email AS seller_email,
                    pr.product_name
             FROM posts p
             INNER JOIN users u ON p.seller_id = u.user_id
             LEFT JOIN products pr ON p.product_id = pr.product_id
             WHERE p.status = ?
             ORDER BY p.created_at DESC`,
            [status]
        );
        res.json(posts);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// PATCH /api/posts/:id/review — admin approves or rejects
exports.reviewPost = async (req, res) => {
    try {
        const adminId = req.user.id;
        const postId = req.params.id;
        const { status, admin_note } = req.body;

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Status must be approved or rejected' });
        }

        const posts = await queryAsync(
            `SELECT post_id, seller_id FROM posts WHERE post_id = ?`, [postId]
        );
        if (!posts.length) return res.status(404).json({ message: 'Post not found' });

        await queryAsync(
            `UPDATE posts SET status = ?, admin_note = ?, reviewed_by = ?, reviewed_at = NOW() WHERE post_id = ?`,
            [status, admin_note || null, adminId, postId]
        );

        createNotification(
            posts[0].seller_id,
            status === 'approved' ? '✅ Post Approved!' : '❌ Post Rejected',
            status === 'approved'
                ? 'Your post has been approved and is now live on the NexoreX feed.'
                : `Your post was rejected. ${admin_note ? 'Admin note: ' + admin_note : 'Please review and resubmit.'}`,
            'system'
        ).catch(() => {});

        res.json({ message: `Post ${status} successfully` });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/posts/:id/like — toggle like
exports.toggleLike = async (req, res) => {
    try {
        const userId = req.user.id;
        const postId = req.params.id;

        const existing = await queryAsync(
            `SELECT like_id FROM post_likes WHERE post_id = ? AND user_id = ?`,
            [postId, userId]
        );

        if (existing.length) {
            await queryAsync(`DELETE FROM post_likes WHERE post_id = ? AND user_id = ?`, [postId, userId]);
            await queryAsync(`UPDATE posts SET like_count = GREATEST(like_count - 1, 0) WHERE post_id = ?`, [postId]);
            return res.json({ liked: false });
        }

        await queryAsync(`INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)`, [postId, userId]);
        await queryAsync(`UPDATE posts SET like_count = like_count + 1 WHERE post_id = ?`, [postId]);
        res.json({ liked: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// DELETE /api/posts/:id — seller deletes own post
exports.deletePost = async (req, res) => {
    try {
        const sellerId = req.user.id;
        const postId = req.params.id;

        const posts = await queryAsync(
            `SELECT post_id, seller_id, image_url FROM posts WHERE post_id = ?`, [postId]
        );
        if (!posts.length) return res.status(404).json({ message: 'Post not found' });
        if (posts[0].seller_id !== sellerId) return res.status(403).json({ message: 'You can only delete your own posts' });

        if (posts[0].image_url) {
            const filePath = path.join(__dirname, '..', posts[0].image_url);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }

        await queryAsync(`DELETE FROM posts WHERE post_id = ?`, [postId]);
        res.json({ message: 'Post deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
