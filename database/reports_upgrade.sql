-- Nexore Seller Reports Upgrade
-- Run this script to add seller reporting support

CREATE TABLE IF NOT EXISTS seller_reports (
    report_id       INT AUTO_INCREMENT PRIMARY KEY,
    buyer_id        INT NOT NULL,
    seller_id       INT NOT NULL,
    reason          ENUM(
                        'fake_listing',
                        'item_not_as_described',
                        'rude_behaviour',
                        'suspected_scam',
                        'other'
                    ) NOT NULL,
    description     TEXT NOT NULL,
    status          ENUM('pending', 'reviewed', 'dismissed') NOT NULL DEFAULT 'pending',
    admin_note      TEXT DEFAULT NULL,
    reviewed_at     DATETIME DEFAULT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (buyer_id)  REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (seller_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_seller  (seller_id),
    INDEX idx_buyer   (buyer_id),
    INDEX idx_status  (status)
);
