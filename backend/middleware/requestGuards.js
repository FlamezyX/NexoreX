'use strict';

const DEFAULT_ALLOWED_ORIGINS = [
    'https://nexorex.vercel.app',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
];

function getAllowedOrigins() {
    const configuredOrigins = [
        process.env.FRONTEND_URL,
        ...(process.env.CORS_ORIGINS || '').split(',')
    ]
        .map((origin) => String(origin || '').trim().replace(/\/+$/, ''))
        .filter(Boolean);

    return new Set([...DEFAULT_ALLOWED_ORIGINS, ...configuredOrigins]);
}

function requireJson(req, res, next) {
    if (!req.is('application/json')) {
        return res.status(415).json({ message: 'Content-Type must be application/json' });
    }
    next();
}

function verifyCsrf(req, res, next) {
    const origin = req.headers.origin;
    const host = req.headers.host;

    if (!origin) {
        return next();
    }

    try {
        const requestOrigin = new URL(origin);
        const normalizedOrigin = requestOrigin.origin.replace(/\/+$/, '');

        if ((host && requestOrigin.host === host) || getAllowedOrigins().has(normalizedOrigin)) {
            return next();
        }
    } catch (error) {
        return res.status(403).json({ message: 'Invalid request origin' });
    }

    return res.status(403).json({ message: 'Cross-origin request blocked' });
}

module.exports = { getAllowedOrigins, requireJson, verifyCsrf };
