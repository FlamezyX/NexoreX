const API_BASE_URL = (
    window.NEXOREX_API_BASE_URL ||
    localStorage.getItem('nexorexApiBaseUrl') ||
    'https://nexorex.onrender.com'
).replace(/\/+$/, '');

function apiUrl(path = '') {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${API_BASE_URL}${normalizedPath}`;
}

function getStoredUser() {
    try {
        return JSON.parse(localStorage.getItem('nexorexUser'));
    } catch (error) {
        return null;
    }
}

function getStoredToken() {
    return localStorage.getItem('nexorexToken');
}

function saveStoredUser(user) {
    localStorage.setItem('nexorexUser', JSON.stringify(user));
}

function logoutUser() {
    localStorage.removeItem('nexorexToken');
    localStorage.removeItem('nexorexUser');
    localStorage.removeItem('nexorexCart');
    window.location.href = './login.html';
}

function authHeaders(extraHeaders = {}) {
    const token = getStoredToken();
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...extraHeaders
    };
}

function getCart() {
    try {
        return JSON.parse(localStorage.getItem('nexorexCart')) || [];
    } catch (error) {
        return [];
    }
}

function saveCart(cart) {
    localStorage.setItem('nexorexCart', JSON.stringify(cart));
}

function addToCart(product) {
    const cart = getCart();
    const existingItem = cart.find((item) => item.product_id === product.product_id);

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            product_id: product.product_id,
            seller_id: product.seller_id,
            name: product.name,
            price: Number(product.price),
            image_url: product.image_url,
            quantity: 1
        });
    }

    saveCart(cart);
    return cart;
}

function updateCartQuantity(productId, quantity) {
    const cart = getCart()
        .map((item) => item.product_id === productId ? { ...item, quantity } : item)
        .filter((item) => item.quantity > 0);

    saveCart(cart);
    return cart;
}

function clearCart() {
    localStorage.removeItem('nexorexCart');
}

function cartCount() {
    return getCart().reduce((sum, item) => sum + item.quantity, 0);
}

function formatMoney(value) {
    const numericValue = Number(value || 0);

    return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(Number.isNaN(numericValue) ? 0 : numericValue);
}

function formatDateShort(value) {
    if (!value) {
        return '';
    }

    return new Date(value).toLocaleDateString('en-NG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatDateTime(value) {
    if (!value) {
        return '';
    }

    return new Date(value).toLocaleString('en-NG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

function orderStatusLabel(status) {
    const labels = {
        pending_payment: 'Waiting for Payment',
        payment_uploaded: 'Payment Uploaded',
        payment_confirmed: 'Payment Confirmed',
        processing: 'Processing',
        shipped: 'Shipped',
        delivered: 'Delivered',
        cancelled: 'Cancelled'
    };

    return labels[status] || status;
}
