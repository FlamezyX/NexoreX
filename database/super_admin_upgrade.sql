USE nexoreX;

-- Add admin_level column to users table for super admin vs sub admin distinction
ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS admin_level TINYINT DEFAULT NULL AFTER role;

-- Create platform_settings table for bank details and other platform configurations
CREATE TABLE IF NOT EXISTS platform_settings (
    setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
    setting_value TEXT DEFAULT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create admin_permissions table for granular sub-admin permissions
CREATE TABLE IF NOT EXISTS admin_permissions (
    admin_id INT NOT NULL PRIMARY KEY,
    manage_applications TINYINT(1) NOT NULL DEFAULT 0,
    manage_products TINYINT(1) NOT NULL DEFAULT 0,
    manage_orders TINYINT(1) NOT NULL DEFAULT 0,
    manage_withdrawals TINYINT(1) NOT NULL DEFAULT 0,
    manage_shipping TINYINT(1) NOT NULL DEFAULT 0,
    manage_reviews TINYINT(1) NOT NULL DEFAULT 0,
    manage_reports TINYINT(1) NOT NULL DEFAULT 0,
    view_analytics TINYINT(1) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_admin_permissions_user
        FOREIGN KEY (admin_id) REFERENCES users(user_id)
        ON DELETE CASCADE
);

-- Create password_resets table for forgot password functionality
CREATE TABLE IF NOT EXISTS password_resets (
    user_id INT NOT NULL,
    token VARCHAR(64) NOT NULL PRIMARY KEY,
    expires_at DATETIME NOT NULL,
    used TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_password_resets_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE CASCADE
);

-- Insert default platform settings
INSERT IGNORE INTO platform_settings (setting_key, setting_value) VALUES
('bank_name', 'First Bank'),
('bank_account_name', 'NexoreX Marketplace'),
('bank_account_number', '0123456789'),
('bank_instructions', 'Use your Order ID as the transfer reference'),
('withdrawal_hold_hours', '24'),
('min_withdrawal_amount', '1000'),
('seller_terms', 'NexoreX Seller Terms and Conditions\nLast updated: June 2025\n\nBy submitting a seller application on NexoreX, you agree to the following terms. Please read them carefully before proceeding.\n\n1. Eligibility\nYou must be at least 18 years old and legally capable of entering into a binding agreement to register as a seller on NexoreX. By applying, you confirm that all information provided is accurate and truthful.\n\n2. Activation Fee\nA one-time store activation fee of ₦3,000 is required to activate your seller account, unless waived by the platform. This fee is non-refundable once your application has been reviewed and approved.\n\n3. Commission\nNexoreX charges a 5% commission on every completed sale. This amount is automatically deducted before your wallet is credited. By selling on this platform, you agree to this deduction.\n\n4. Product Listings\nAll products must be accurately described, legally owned or authorized for sale, and must not violate any applicable laws. NexoreX reserves the right to reject or remove any product listing at its discretion.\n\n5. Prohibited Items\nYou may not list counterfeit goods, stolen items, illegal products, or anything that violates Nigerian law or NexoreX platform policies. Violation of this rule will result in immediate account suspension.\n\n6. Order Fulfillment\nAs a seller, you are responsible for fulfilling orders promptly and honestly. Failure to deliver goods after payment confirmation may result in penalties, suspension, or permanent removal from the platform.\n\n7. Payouts and Withdrawals\nEarnings are credited to your NexoreX wallet after order completion. Withdrawals are subject to a minimum balance requirement and a hold period set by the platform. NexoreX reserves the right to withhold funds pending investigation of disputes or suspicious activity.\n\n8. Conduct\nYou agree to communicate professionally with buyers and platform staff. Harassment, fraud, or any form of misconduct will result in immediate account termination without refund.\n\n9. Account Suspension\nNexoreX reserves the right to suspend or permanently ban any seller account found to be in violation of these terms, without prior notice in cases of serious misconduct.\n\n10. Changes to Terms\nNexoreX may update these terms at any time. Continued use of the platform after changes are published constitutes acceptance of the updated terms.\n\n11. Governing Law\nThese terms are governed by the laws of the Federal Republic of Nigeria. Any disputes shall be resolved under Nigerian jurisdiction.');