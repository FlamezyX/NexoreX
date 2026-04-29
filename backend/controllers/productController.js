'use strict';

const fs = require('fs');
const path = require('path');
const db = require('../db');

const productImagesDir = path.join(__dirname, '..', 'uploads', 'product-images');
if (!fs.existsSync(productImagesDir)) fs.mkdirSync(productImagesDir, { recursive: true });

// POST /api/products/upload-image — accepts base64 image, saves to disk, returns URL
exports.uploadProductImage = (req, res) => {
    const { image_data, image_name } = req.body;
    if (!image_data) return res.status(400).json({ message: 'No image data provided' });

    const match = String(image_data).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) return res.status(400).json({ message: 'Invalid image format' });

    const mimeType = match[1].toLowerCase();
    const allowed = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
    const ext = allowed[mimeType];
    if (!ext) return res.status(400).json({ message: 'Only JPG, PNG, or WEBP images are allowed' });

    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > 5 * 1024 * 1024) return res.status(400).json({ message: 'Image must be 5MB or smaller' });

    const safeName = String(image_name || 'product').replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 50);
    const fileName = `product-${req.user.id}-${Date.now()}-${safeName}.${ext}`;
    const filePath = path.join(productImagesDir, fileName);

    try {
        fs.writeFileSync(filePath, buffer);
        res.json({ image_url: `/uploads/product-images/${fileName}` });
    } catch (err) {
        res.status(500).json({ message: 'Could not save image' });
    }
};

exports.addProduct = (req, res) => {
    const seller_id = req.user.id;
    const name = req.body.name;
    const description = req.body.description;
    const price = req.body.price;
    const image_url = req.body.image_url ?? req.body.imageUrl;
    const category_id = req.body.category_id ?? req.body.categoryId ?? null;
    const stock_quantity = req.body.stock_quantity ?? req.body.stockQuantity ?? 0;

    if (seller_id == null || !name || !description || price == null || !image_url) {
        return res.status(400).json({
            message: 'Missing required product fields',
            expected: ['seller_id', 'name', 'description', 'price', 'image_url']
        });
    }

    db.query(
        'SELECT user_id, role, seller_status FROM users WHERE user_id = ?',
        [seller_id],
        (userErr, userResults) => {
            if (userErr) return res.status(500).json(userErr);

            if (userResults.length === 0) {
                return res.status(404).json({ message: 'Seller account not found' });
            }

            const seller = userResults[0];

            if (seller.role !== 'seller') {
                return res.status(400).json({ message: 'Only seller accounts can add products' });
            }

            if (seller.seller_status !== 'approved') {
                return res.status(403).json({
                    message: 'Only approved sellers can publish products'
                });
            }

            db.query(
                `INSERT INTO products
                (seller_id, category_id, product_name, description, price, image_url, stock_quantity, approval_status, product_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'active')`,
                [seller_id, category_id, name, description, price, image_url, stock_quantity],
                (err) => {
                    if (err) return res.status(500).json(err);
                    res.status(201).json({
                        message: 'Product submitted successfully and is pending admin approval'
                    });
                }
            );
        }
    );
};

exports.getCategories = (req, res) => {
    db.query(
        `SELECT category_id, name, slug FROM categories WHERE is_active = 1 ORDER BY name ASC`,
        (err, results) => {
            if (err) return res.status(500).json(err);
            res.json(results);
        }
    );
};

exports.getProducts = (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 12));
    const offset = (page - 1) * limit;
    const search = req.query.search?.trim() || '';
    const searchParam = search ? `%${search}%` : null;
    const categoryId = req.query.category_id ? parseInt(req.query.category_id) : null;

    const whereClauses = [`p.approval_status = 'approved'`, `p.product_status = 'active'`];
    const params = [];

    if (searchParam) {
        whereClauses.push(`(p.product_name LIKE ? OR p.description LIKE ? OR u.fullname LIKE ?)`);
        params.push(searchParam, searchParam, searchParam);
    }

    if (categoryId) {
        whereClauses.push(`p.category_id = ?`);
        params.push(categoryId);
    }

    const where = `WHERE ${whereClauses.join(' AND ')}`;

    db.query(
        `SELECT COUNT(*) AS total FROM products p INNER JOIN users u ON p.seller_id = u.user_id ${where}`,
        params,
        (countErr, countRows) => {
            if (countErr) return res.status(500).json(countErr);
            const total = countRows[0].total;

            db.query(
                `SELECT
                    p.product_id, p.seller_id, p.category_id, p.product_name AS name,
                    p.description, p.price, p.image_url, p.stock_quantity,
                    p.product_status, p.approval_status, p.created_at,
                    u.fullname AS seller_name,
                    COALESCE(ROUND(AVG(CASE WHEN r.review_status = 'published' THEN r.rating END), 1), 0) AS average_rating,
                    COUNT(CASE WHEN r.review_status = 'published' THEN r.review_id END) AS review_count
                FROM products p
                INNER JOIN users u ON p.seller_id = u.user_id
                LEFT JOIN reviews r ON p.product_id = r.product_id
                ${where}
                GROUP BY p.product_id, p.seller_id, p.category_id, p.product_name,
                    p.description, p.price, p.image_url, p.stock_quantity,
                    p.product_status, p.approval_status, p.created_at, u.fullname
                ORDER BY p.created_at DESC
                LIMIT ? OFFSET ?`,
                [...params, limit, offset],
                (err, results) => {
                    if (err) return res.status(500).json(err);
                    res.json({
                        products: results,
                        total,
                        page,
                        limit,
                        totalPages: Math.ceil(total / limit)
                    });
                }
            );
        }
    );
};

exports.getSellerProducts = (req, res) => {
    const requestedSellerId = Number(req.params.sellerId);
    const sellerId = req.user.role === 'admin' ? requestedSellerId : req.user.id;

    db.query(
        `SELECT
            product_id,
            seller_id,
            category_id,
            product_name AS name,
            description,
            price,
            image_url,
            stock_quantity,
            product_status,
            approval_status,
            created_at
        FROM products
        WHERE seller_id = ?
        ORDER BY created_at DESC`,
        [sellerId],
        (err, results) => {
            if (err) return res.status(500).json(err);
            res.json(results);
        }
    );
};

exports.getSellerProfile = (req, res) => {
    const sellerId = Number(req.params.sellerId);

    db.query(
        `SELECT
            u.user_id,
            u.fullname,
            u.location,
            u.created_at,
            (
                SELECT COUNT(*)
                FROM products p
                WHERE p.seller_id = u.user_id
                    AND p.approval_status = 'approved'
                    AND p.product_status = 'active'
            ) AS product_count,
            (
                SELECT COALESCE(ROUND(AVG(r.rating), 1), 0)
                FROM reviews r
                WHERE r.seller_id = u.user_id
                    AND r.review_status = 'published'
            ) AS average_rating,
            (
                SELECT COUNT(*)
                FROM reviews r
                WHERE r.seller_id = u.user_id
                    AND r.review_status = 'published'
            ) AS review_count
        FROM users u
        WHERE u.user_id = ? AND u.role = 'seller'`,
        [sellerId],
        (profileErr, profileResults) => {
            if (profileErr) return res.status(500).json(profileErr);

            if (!profileResults.length) {
                return res.status(404).json({ message: 'Seller profile not found' });
            }

            db.query(
                `SELECT
                    p.product_id,
                    p.product_name AS name,
                    p.description,
                    p.price,
                    p.image_url,
                    p.created_at,
                    COALESCE(ROUND(AVG(CASE WHEN r.review_status = 'published' THEN r.rating END), 1), 0) AS average_rating,
                    COUNT(CASE WHEN r.review_status = 'published' THEN r.review_id END) AS review_count
                FROM products p
                LEFT JOIN reviews r ON p.product_id = r.product_id
                WHERE p.seller_id = ? AND p.approval_status = 'approved' AND p.product_status = 'active'
                GROUP BY p.product_id, p.product_name, p.description, p.price, p.image_url, p.created_at
                ORDER BY p.created_at DESC`,
                [sellerId],
                (productsErr, productResults) => {
                    if (productsErr) return res.status(500).json(productsErr);

                    res.json({
                        seller: profileResults[0],
                        products: productResults
                    });
                }
            );
        }
    );
};
