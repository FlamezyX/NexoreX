-- Nexore Admin Hierarchy Upgrade
-- Run this script to add super admin and sub-admin permission support

-- Add admin_level column to users (1 = super admin, 2 = sub admin)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS admin_level TINYINT DEFAULT NULL COMMENT '1=super_admin, 2=sub_admin';

-- Create admin_permissions table
CREATE TABLE IF NOT EXISTS admin_permissions (
    permission_id       INT AUTO_INCREMENT PRIMARY KEY,
    admin_id            INT NOT NULL,
    manage_applications TINYINT(1) NOT NULL DEFAULT 0,
    manage_products     TINYINT(1) NOT NULL DEFAULT 0,
    manage_orders       TINYINT(1) NOT NULL DEFAULT 0,
    manage_withdrawals  TINYINT(1) NOT NULL DEFAULT 0,
    manage_shipping     TINYINT(1) NOT NULL DEFAULT 0,
    manage_reviews      TINYINT(1) NOT NULL DEFAULT 0,
    manage_reports      TINYINT(1) NOT NULL DEFAULT 0,
    view_analytics      TINYINT(1) NOT NULL DEFAULT 0,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY unique_admin (admin_id)
);

-- Set existing admins as super admin by default
UPDATE users SET admin_level = 1 WHERE role = 'admin';
