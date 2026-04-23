-- Nexore Chat System Upgrade
-- Run this script to add messaging support

CREATE TABLE IF NOT EXISTS messages (
    message_id     INT AUTO_INCREMENT PRIMARY KEY,
    sender_id      INT NOT NULL,
    receiver_id    INT NOT NULL,
    product_id     INT DEFAULT NULL,
    message        TEXT NOT NULL,
    is_read        TINYINT(1) NOT NULL DEFAULT 0,
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id)   REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id)  REFERENCES products(product_id) ON DELETE SET NULL,
    INDEX idx_conversation (sender_id, receiver_id),
    INDEX idx_receiver (receiver_id),
    INDEX idx_created (created_at)
);
