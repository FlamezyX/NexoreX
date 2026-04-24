'use strict';
require('dotenv').config();
const db = require('../db');

db.query(`CREATE TABLE IF NOT EXISTS posts (
    post_id INT AUTO_INCREMENT PRIMARY KEY,
    seller_id INT NOT NULL,
    caption TEXT NOT NULL,
    image_url VARCHAR(500) DEFAULT NULL,
    product_id INT DEFAULT NULL,
    status ENUM('pending','approved','rejected') DEFAULT 'pending',
    admin_note VARCHAR(300) DEFAULT NULL,
    reviewed_by INT DEFAULT NULL,
    reviewed_at DATETIME DEFAULT NULL,
    like_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (seller_id) REFERENCES users(user_id) ON DELETE CASCADE
)`, (err) => {
    if (err) { console.error('posts:', err.message); process.exit(1); }
    console.log('posts table ready');

    db.query(`CREATE TABLE IF NOT EXISTS post_likes (
        like_id INT AUTO_INCREMENT PRIMARY KEY,
        post_id INT NOT NULL,
        user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_like (post_id, user_id),
        FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE
    )`, (err2) => {
        if (err2) { console.error('post_likes:', err2.message); process.exit(1); }
        console.log('post_likes table ready');
        process.exit(0);
    });
});
