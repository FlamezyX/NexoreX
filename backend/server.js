const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const db = require('./db');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: [
            'https://nexorex.vercel.app',
            'http://localhost:5500',
            'http://127.0.0.1:5500'
        ],
        credentials: true
    }
});

app.use(cors({
    origin: [
        'https://nexorex.vercel.app',
        'http://localhost:5500',
        'http://127.0.0.1:5500'
    ],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => {
    res.send('NexoreX API is running 🚀');
});

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const orderRoutes = require('./routes/order');
const productRoutes = require('./routes/product');
const shippingRoutes = require('./routes/shipping');
const walletRoutes = require('./routes/wallet');
const notificationRoutes = require('./routes/notification');
const reviewRoutes = require('./routes/review');
const chatRoutes = require('./routes/chat');
const reportRoutes = require('./routes/report');
const superAdminRoutes = require('./routes/superAdmin');
const platformSettingsRoutes = require('./routes/platformSettings');
const postRoutes = require('./routes/post');

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/products', productRoutes);
app.use('/api/shipping-options', shippingRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/platform-settings', platformSettingsRoutes);
app.use('/api/posts', postRoutes);

// Socket.io — real-time chat
const onlineUsers = new Map();

io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded;
        next();
    } catch {
        next(new Error('Invalid token'));
    }
});

io.on('connection', (socket) => {
    const userId = socket.user.id;
    onlineUsers.set(userId, socket.id);

    socket.broadcast.emit('user_online', { userId });
    socket.emit('online_users', Array.from(onlineUsers.keys()));

    socket.on('send_message', (data) => {
        const { receiver_id, message, product_id } = data;

        if (!receiver_id || !message?.trim()) return;

        db.query(
            'INSERT INTO messages (sender_id, receiver_id, message, product_id) VALUES (?, ?, ?, ?)',
            [userId, receiver_id, message.trim(), product_id || null],
            (err, result) => {
                if (err) return;

                db.query(
                    `SELECT m.message_id, m.sender_id, m.receiver_id, m.message, m.is_read,
                            m.created_at, m.product_id, p.product_name
                     FROM messages m
                     LEFT JOIN products p ON m.product_id = p.product_id
                     WHERE m.message_id = ?`,
                    [result.insertId],
                    (err2, rows) => {
                        if (err2 || !rows.length) return;

                        const msg = rows[0];

                        const receiverSocketId = onlineUsers.get(Number(receiver_id));
                        if (receiverSocketId) {
                            io.to(receiverSocketId).emit('new_message', msg);
                        }

                        socket.emit('message_sent', msg);
                    }
                );
            }
        );
    });

    socket.on('typing', ({ receiver_id }) => {
        const receiverSocketId = onlineUsers.get(Number(receiver_id));
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('user_typing', { sender_id: userId });
        }
    });

    socket.on('stop_typing', ({ receiver_id }) => {
        const receiverSocketId = onlineUsers.get(Number(receiver_id));
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('user_stop_typing', { sender_id: userId });
        }
    });

    socket.on('disconnect', () => {
        onlineUsers.delete(userId);
        socket.broadcast.emit('user_offline', { userId });
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
