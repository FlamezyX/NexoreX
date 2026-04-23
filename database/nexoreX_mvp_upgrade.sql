USE nexoreX;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role ENUM('buyer', 'seller', 'admin') NOT NULL DEFAULT 'buyer' AFTER referred_by,
    ADD COLUMN IF NOT EXISTS account_status ENUM('active', 'pending', 'suspended') NOT NULL DEFAULT 'active' AFTER role,
    ADD COLUMN IF NOT EXISTS seller_status ENUM('not_applied', 'pending', 'approved', 'rejected') NOT NULL DEFAULT 'not_applied' AFTER account_status,
    ADD COLUMN IF NOT EXISTS seller_approved_at DATETIME DEFAULT NULL AFTER seller_status,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

CREATE TABLE IF NOT EXISTS categories (
    category_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(120) NOT NULL UNIQUE,
    description TEXT DEFAULT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS promo_settings (
    promo_setting_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    is_active TINYINT(1) NOT NULL DEFAULT 0,
    promo_title VARCHAR(150) DEFAULT 'Free Store Promo',
    promo_description TEXT DEFAULT NULL,
    promo_questions TEXT DEFAULT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS promo_logs (
    promo_log_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    admin_user_id INT DEFAULT NULL,
    action_type ENUM('activated', 'deactivated', 'updated_questions') NOT NULL,
    title_snapshot VARCHAR(150) DEFAULT NULL,
    description_snapshot TEXT DEFAULT NULL,
    questions_snapshot TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_promo_logs_admin
        FOREIGN KEY (admin_user_id) REFERENCES users(user_id)
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS seller_applications (
    application_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    business_name VARCHAR(150) NOT NULL,
    business_description TEXT DEFAULT NULL,
    phone VARCHAR(20) DEFAULT NULL,
    location VARCHAR(100) DEFAULT NULL,
    application_type ENUM('paid', 'promo') NOT NULL DEFAULT 'paid',
    store_fee_amount DECIMAL(10, 2) NOT NULL DEFAULT 3000.00,
    payment_status ENUM('not_required', 'pending', 'submitted', 'verified', 'rejected') NOT NULL DEFAULT 'pending',
    payment_verified_at DATETIME DEFAULT NULL,
    payment_reference VARCHAR(120) DEFAULT NULL,
    promo_status ENUM('not_applied', 'pending', 'qualified', 'rejected') NOT NULL DEFAULT 'not_applied',
    promo_answers TEXT DEFAULT NULL,
    status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    admin_note TEXT DEFAULT NULL,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME DEFAULT NULL,
    CONSTRAINT fk_seller_applications_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE CASCADE
);

ALTER TABLE seller_applications
    ADD COLUMN IF NOT EXISTS application_type ENUM('paid', 'promo') NOT NULL DEFAULT 'paid' AFTER location,
    ADD COLUMN IF NOT EXISTS store_fee_amount DECIMAL(10, 2) NOT NULL DEFAULT 3000.00 AFTER application_type,
    ADD COLUMN IF NOT EXISTS payment_status ENUM('not_required', 'pending', 'submitted', 'verified', 'rejected') NOT NULL DEFAULT 'pending' AFTER store_fee_amount,
    ADD COLUMN IF NOT EXISTS payment_verified_at DATETIME DEFAULT NULL AFTER payment_status,
    ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(120) DEFAULT NULL AFTER payment_status,
    ADD COLUMN IF NOT EXISTS payment_proof_url TEXT DEFAULT NULL AFTER payment_reference,
    ADD COLUMN IF NOT EXISTS promo_status ENUM('not_applied', 'pending', 'qualified', 'rejected') NOT NULL DEFAULT 'not_applied' AFTER payment_proof_url,
    ADD COLUMN IF NOT EXISTS promo_answers TEXT DEFAULT NULL AFTER promo_status;

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS category_id INT DEFAULT NULL AFTER seller_id,
    ADD COLUMN IF NOT EXISTS stock_quantity INT NOT NULL DEFAULT 0 AFTER description,
    ADD COLUMN IF NOT EXISTS product_status ENUM('active', 'inactive', 'out_of_stock') NOT NULL DEFAULT 'active' AFTER stock_quantity,
    ADD COLUMN IF NOT EXISTS approval_status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'approved' AFTER product_status,
    ADD COLUMN IF NOT EXISTS admin_note TEXT DEFAULT NULL AFTER approval_status,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

CREATE TABLE IF NOT EXISTS shipping_options (
    shipping_option_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT DEFAULT NULL,
    delivery_time VARCHAR(50) NOT NULL,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    order_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    buyer_id INT NOT NULL,
    seller_id INT NOT NULL,
    shipping_option_id INT DEFAULT NULL,
    subtotal_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    shipping_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    commission_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    seller_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    status ENUM('pending_payment', 'payment_uploaded', 'payment_confirmed', 'processing', 'shipped', 'delivered', 'cancelled') NOT NULL DEFAULT 'pending_payment',
    payment_reference VARCHAR(100) DEFAULT NULL,
    payment_proof_url TEXT DEFAULT NULL,
    admin_note TEXT DEFAULT NULL,
    delivery_address TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_orders_buyer
        FOREIGN KEY (buyer_id) REFERENCES users(user_id),
    CONSTRAINT fk_orders_seller
        FOREIGN KEY (seller_id) REFERENCES users(user_id),
    CONSTRAINT fk_orders_shipping_option
        FOREIGN KEY (shipping_option_id) REFERENCES shipping_options(shipping_option_id)
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS order_items (
    order_item_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_order_items_order
        FOREIGN KEY (order_id) REFERENCES orders(order_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_order_items_product
        FOREIGN KEY (product_id) REFERENCES products(product_id)
);

CREATE TABLE IF NOT EXISTS wallets (
    wallet_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    seller_id INT NOT NULL UNIQUE,
    total_earned DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    available_balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    pending_balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    total_withdrawn DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_wallets_seller
        FOREIGN KEY (seller_id) REFERENCES users(user_id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transactions (
    transaction_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    order_id INT DEFAULT NULL,
    seller_id INT DEFAULT NULL,
    buyer_id INT DEFAULT NULL,
    transaction_type ENUM('payment', 'commission', 'wallet_credit', 'withdrawal') NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status ENUM('pending', 'completed', 'failed') NOT NULL DEFAULT 'pending',
    reference_code VARCHAR(100) DEFAULT NULL,
    note TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_transactions_order
        FOREIGN KEY (order_id) REFERENCES orders(order_id)
        ON DELETE SET NULL,
    CONSTRAINT fk_transactions_seller
        FOREIGN KEY (seller_id) REFERENCES users(user_id)
        ON DELETE SET NULL,
    CONSTRAINT fk_transactions_buyer
        FOREIGN KEY (buyer_id) REFERENCES users(user_id)
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS withdrawal_requests (
    withdrawal_request_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    seller_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    bank_name VARCHAR(120) DEFAULT NULL,
    account_name VARCHAR(120) DEFAULT NULL,
    account_number VARCHAR(30) DEFAULT NULL,
    status ENUM('pending', 'approved', 'rejected', 'paid') NOT NULL DEFAULT 'pending',
    admin_note TEXT DEFAULT NULL,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME DEFAULT NULL,
    CONSTRAINT fk_withdrawal_requests_seller
        FOREIGN KEY (seller_id) REFERENCES users(user_id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reviews (
    review_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    buyer_id INT NOT NULL,
    seller_id INT NOT NULL,
    rating TINYINT NOT NULL,
    comment TEXT DEFAULT NULL,
    review_status ENUM('published', 'hidden', 'flagged') NOT NULL DEFAULT 'published',
    admin_note TEXT DEFAULT NULL,
    moderated_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reviews_order
        FOREIGN KEY (order_id) REFERENCES orders(order_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_reviews_product
        FOREIGN KEY (product_id) REFERENCES products(product_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_reviews_buyer
        FOREIGN KEY (buyer_id) REFERENCES users(user_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_reviews_seller
        FOREIGN KEY (seller_id) REFERENCES users(user_id)
        ON DELETE CASCADE
);

ALTER TABLE reviews
    ADD COLUMN IF NOT EXISTS review_status ENUM('published', 'hidden', 'flagged') NOT NULL DEFAULT 'published' AFTER comment,
    ADD COLUMN IF NOT EXISTS admin_note TEXT DEFAULT NULL AFTER review_status,
    ADD COLUMN IF NOT EXISTS moderated_at DATETIME DEFAULT NULL AFTER admin_note;

CREATE TABLE IF NOT EXISTS notifications (
    notification_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    notification_type ENUM('order', 'system', 'payment', 'withdrawal', 'message') NOT NULL DEFAULT 'system',
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notifications_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
    message_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    sender_id INT NOT NULL,
    receiver_id INT NOT NULL,
    order_id INT DEFAULT NULL,
    message_text TEXT NOT NULL,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_messages_sender
        FOREIGN KEY (sender_id) REFERENCES users(user_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_messages_receiver
        FOREIGN KEY (receiver_id) REFERENCES users(user_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_messages_order
        FOREIGN KEY (order_id) REFERENCES orders(order_id)
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS platform_earnings (
    earning_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    commission_rate DECIMAL(5, 2) NOT NULL DEFAULT 5.00,
    gross_amount DECIMAL(10, 2) NOT NULL,
    commission_amount DECIMAL(10, 2) NOT NULL,
    seller_amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_platform_earnings_order
        FOREIGN KEY (order_id) REFERENCES orders(order_id)
        ON DELETE CASCADE
);
