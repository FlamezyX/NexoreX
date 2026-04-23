'use strict';

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

async function sendMail({ to, subject, html }) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('[Email] EMAIL_USER or EMAIL_PASS not set — skipping email to', to);
        return;
    }
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_FROM || `NexoreX <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html
        });
        console.log(`[Email] Sent "${subject}" to ${to}`);
    } catch (err) {
        console.error('[Email] Failed to send to', to, '—', err.message);
    }
}

function welcomeSellerEmail(name) {
    return {
        subject: 'Welcome to NexoreX — Your Seller Account is Being Reviewed',
        html: `
        <div style="font-family:'Trebuchet MS',Verdana,sans-serif;max-width:580px;margin:0 auto;background:#f7f1e8;border-radius:20px;overflow:hidden;">
            <div style="background:linear-gradient(135deg,#c05621,#7c2d12);padding:36px 32px;text-align:center;">
                <h1 style="margin:0;color:#fff;font-size:2rem;letter-spacing:0.06em;text-transform:uppercase;">NexoreX</h1>
                <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:0.95rem;">Multi-Vendor Marketplace</p>
            </div>
            <div style="padding:36px 32px;">
                <h2 style="margin:0 0 12px;font-size:1.5rem;color:#1f2933;">Welcome, ${name}! 🎉</h2>
                <p style="color:#61707a;line-height:1.7;margin:0 0 20px;">
                    Thank you for registering as a seller on <strong>NexoreX</strong>. We're excited to have you on board.
                </p>
                <div style="background:#fff;border-radius:14px;padding:20px 24px;border:1px solid rgba(15,23,42,0.08);margin-bottom:20px;">
                    <h3 style="margin:0 0 10px;color:#1f2933;font-size:1rem;">What happens next?</h3>
                    <ol style="margin:0;padding-left:20px;color:#61707a;line-height:2;">
                        <li>Complete your seller application on your dashboard</li>
                        <li>Our admin team will review your business details</li>
                        <li>Once approved, you can start listing products</li>
                        <li>Earn 95% of every sale — we only take a 5% platform fee</li>
                    </ol>
                </div>
                <p style="color:#61707a;line-height:1.7;margin:0 0 24px;">
                    If you have any questions, you can reach us directly through the messaging system on the platform.
                </p>
                <a href="http://localhost:5000" style="display:inline-block;background:linear-gradient(135deg,#c05621,#7c2d12);color:#fff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:700;">
                    Go to Your Dashboard
                </a>
            </div>
            <div style="padding:20px 32px;border-top:1px solid rgba(15,23,42,0.08);text-align:center;color:#9aa5ae;font-size:0.85rem;">
                © ${new Date().getFullYear()} NexoreX · You're receiving this because you registered as a seller.
            </div>
        </div>`
    };
}

function welcomeSubAdminEmail(name, permissions) {
    const permLabels = {
        manage_applications: 'Seller Applications',
        manage_products: 'Product Approvals',
        manage_orders: 'Payment Confirmations',
        manage_withdrawals: 'Withdrawals',
        manage_shipping: 'Shipping Options',
        manage_reviews: 'Review Moderation',
        manage_reports: 'Seller Reports',
        view_analytics: 'Analytics'
    };

    const permList = permissions.length
        ? permissions.map(p => `<li style="line-height:2;">${permLabels[p] || p}</li>`).join('')
        : '<li style="line-height:2;color:#9aa5ae;">No specific permissions assigned yet</li>';

    return {
        subject: 'You\'ve Been Promoted — Welcome to the NexoreX Admin Team',
        html: `
        <div style="font-family:'Trebuchet MS',Verdana,sans-serif;max-width:580px;margin:0 auto;background:#eef3f8;border-radius:20px;overflow:hidden;">
            <div style="background:linear-gradient(135deg,#1d4ed8,#1e3a8a);padding:36px 32px;text-align:center;">
                <h1 style="margin:0;color:#fff;font-size:2rem;letter-spacing:0.06em;text-transform:uppercase;">NexoreX</h1>
                <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:0.95rem;">Admin Team</p>
            </div>
            <div style="padding:36px 32px;">
                <h2 style="margin:0 0 12px;font-size:1.5rem;color:#1f2933;">Congratulations, ${name}! 👑</h2>
                <p style="color:#61707a;line-height:1.7;margin:0 0 20px;">
                    You have been promoted to <strong>Sub-Admin</strong> on <strong>NexoreX</strong> by the platform super admin.
                    You now have access to the admin dashboard with the following permissions:
                </p>
                <div style="background:#fff;border-radius:14px;padding:20px 24px;border:1px solid rgba(15,23,42,0.08);margin-bottom:20px;">
                    <h3 style="margin:0 0 10px;color:#1f2933;font-size:1rem;">Your Permissions</h3>
                    <ul style="margin:0;padding-left:20px;color:#61707a;">
                        ${permList}
                    </ul>
                </div>
                <p style="color:#61707a;line-height:1.7;margin:0 0 24px;">
                    Log in with your existing account credentials to access the admin dashboard. Your permissions can be updated at any time by the super admin.
                </p>
                <a href="http://localhost:5000/admin-dashboard.html" style="display:inline-block;background:linear-gradient(135deg,#1d4ed8,#1e3a8a);color:#fff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:700;">
                    Go to Admin Dashboard
                </a>
            </div>
            <div style="padding:20px 32px;border-top:1px solid rgba(15,23,42,0.08);text-align:center;color:#9aa5ae;font-size:0.85rem;">
                © ${new Date().getFullYear()} NexoreX · You're receiving this because you were promoted to sub-admin.
            </div>
        </div>`
    };
}

module.exports = { sendMail, welcomeSellerEmail, welcomeSubAdminEmail };
