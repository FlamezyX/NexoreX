'use strict';

const dbModule = require('../db');
const db = dbModule;

exports.getShippingOptions = (req, res) => {
    db.query(
        `SELECT
            shipping_option_id,
            name,
            description,
            delivery_time,
            price,
            is_active
        FROM shipping_options
        WHERE is_active = 1
        ORDER BY price ASC`,
        (err, results) => {
            if (err) return res.status(500).json(err);
            res.json(results);
        }
    );
};

exports.getAllShippingOptions = (req, res) => {
    db.query(
        `SELECT
            shipping_option_id,
            name,
            description,
            delivery_time,
            price,
            is_active,
            created_at
        FROM shipping_options
        ORDER BY created_at DESC, shipping_option_id DESC`,
        (err, results) => {
            if (err) return res.status(500).json(err);
            res.json(results);
        }
    );
};

exports.createShippingOption = (req, res) => {
    const {
        name,
        description,
        delivery_time,
        price,
        is_active
    } = req.body;

    if (!name?.trim() || !delivery_time?.trim()) {
        return res.status(400).json({ message: 'Name and delivery time are required' });
    }

    const numericPrice = Number(price);

    if (Number.isNaN(numericPrice) || numericPrice < 0) {
        return res.status(400).json({ message: 'Price must be a valid number' });
    }

    db.query(
        `INSERT INTO shipping_options
        (name, description, delivery_time, price, is_active)
        VALUES (?, ?, ?, ?, ?)`,
        [
            name.trim(),
            description?.trim() || null,
            delivery_time.trim(),
            numericPrice,
            is_active === 0 || is_active === false ? 0 : 1
        ],
        (err, result) => {
            if (err) return res.status(500).json(err);
            res.status(201).json({
                message: 'Shipping option created successfully',
                shipping_option_id: result.insertId
            });
        }
    );
};

exports.updateShippingOption = (req, res) => {
    const shippingOptionId = req.params.id;
    const {
        name,
        description,
        delivery_time,
        price,
        is_active
    } = req.body;

    if (!name?.trim() || !delivery_time?.trim()) {
        return res.status(400).json({ message: 'Name and delivery time are required' });
    }

    const numericPrice = Number(price);

    if (Number.isNaN(numericPrice) || numericPrice < 0) {
        return res.status(400).json({ message: 'Price must be a valid number' });
    }

    db.query(
        `UPDATE shipping_options
         SET name = ?,
             description = ?,
             delivery_time = ?,
             price = ?,
             is_active = ?
         WHERE shipping_option_id = ?`,
        [
            name.trim(),
            description?.trim() || null,
            delivery_time.trim(),
            numericPrice,
            is_active === 0 || is_active === false ? 0 : 1,
            shippingOptionId
        ],
        (err, result) => {
            if (err) return res.status(500).json(err);

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Shipping option not found' });
            }

            res.json({ message: 'Shipping option updated successfully' });
        }
    );
};
