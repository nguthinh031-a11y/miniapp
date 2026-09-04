const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const BOT_TOKEN = '8774262600:AAFcG0dGDWHJjWpHimRErS9vVbWQj82TdNY'; // Thay token bot Telegram của bạn vào đây
const ADMIN_ID = 8647955563;        // Thay Telegram ID của Admin vào đây
const PORT = 3000;

const bot = new Telegraf(BOT_TOKEN);
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- MIDDLEWARE KIỂM TRA IP MÁY CHỦ ---
const restrictToLocalhost = (req, res, next) => {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const isLocal = clientIp.includes('127.0.0.1') || clientIp.includes('::1') || clientIp === 'localhost';
    if (!isLocal) {
        console.warn(`[CẢNH BÁO BẢO MẬT] Phát hiện truy cập API từ IP lạ: ${clientIp}`);
    }
    next();
};

// --- DATABASE SETUP ---
const db = new sqlite3.Database(path.join(__dirname, 'data.db'), (err) => {
    if (err) console.error('Lỗi kết nối SQLite:', err.message);
    else console.log('Đã kết nối cơ sở dữ liệu SQLite.');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        telegram_id INTEGER PRIMARY KEY,
        balance INTEGER DEFAULT 0
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        price INTEGER,
        description TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER,
        key_content TEXT,
        is_sold INTEGER DEFAULT 0
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id INTEGER,
        product_name TEXT,
        key_content TEXT,
        price INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS deposits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id INTEGER,
        amount INTEGER,
        status TEXT DEFAULT 'PENDING',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )`);
});

// --- TELEGRAM BOT & XỬ LÝ NÚT DUYỆT QUA CHAT BOT ---
bot.start((ctx) => {
    const webAppUrl = `http://localhost:${PORT}?id=${ctx.from.id}`;
    ctx.reply(`🌸 Chào mừng bạn đến với cửa hàng! Bấm vào nút bên dưới để mở ứng dụng mua hàng:`, {
        reply_markup: {
            inline_keyboard: [
                [{ text: '💖 Mở Cửa Hàng (Mini App)', web_app: { url: webAppUrl } }]
            ]
        }
    });
});

// Xử lý sự kiện Admin bấm nút duyệt/hủy trực tiếp từ tin nhắn Telegram Bot
bot.action(/^approve_deposit_(\d+)_(\d+)_(\d+)$/, async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery('Bạn không có quyền thực hiện hành động này!');
    
    const depositId = ctx.match[1];
    const telegramId = ctx.match[2];
    const amount = Number(ctx.match[3]);

    db.get(`SELECT * FROM deposits WHERE id = ? AND status = 'PENDING'`, [depositId], (err, dep) => {
        if (!dep) return ctx.answerCbQuery('Giao dịch này đã được duyệt hoặc không tồn tại!');

        db.run(`UPDATE deposits SET status = 'APPROVED' WHERE id = ?`, [depositId]);
        db.run(`UPDATE users SET balance = balance + ? WHERE telegram_id = ?`, [amount, telegramId], () => {
            bot.telegram.sendMessage(telegram_id, `✨ Tài khoản của bạn đã được cộng thêm thành công ${amount.toLocaleString()} VNĐ từ yêu cầu nạp tiền!`);
            ctx.editMessageText(`✅ Đã DUYỆT thành công nạp tiền cho User: <code>${telegramId}</code> với số tiền <b>${amount.toLocaleString()} VNĐ</b>`, { parse_mode: 'HTML' });
            ctx.answerCbQuery('Đã duyệt thành công!');
        });
    });
});

bot.launch().then(() => {
    console.log('🤖 Bot Telegram đã chạy và sẵn sàng nhận lệnh/nút duyệt!');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// --- API BACKEND ---
app.get('/api/user/:id', (req, res) => {
    const userId = req.params.id;
    db.get(`SELECT * FROM users WHERE telegram_id = ?`, [userId], (err, row) => {
        if (!row) {
            db.run(`INSERT INTO users (telegram_id, balance) VALUES (?, 0)`, [userId]);
            res.json({ telegram_id: userId, balance: 0, isAdmin: Number(userId) === ADMIN_ID });
        } else {
            res.json({ ...row, isAdmin: Number(userId) === ADMIN_ID });
        }
    });
});

app.get('/api/products', (req, res) => {
    db.all(`SELECT p.*, (SELECT COUNT(*) FROM keys k WHERE k.product_id = p.id AND k.is_sold = 0) as stock FROM products p`, [], (err, rows) => {
        res.json(rows);
    });
});

app.get('/api/orders/:id', (req, res) => {
    db.all(`SELECT * FROM orders WHERE telegram_id = ? ORDER BY id DESC`, [req.params.id], (err, rows) => {
        res.json(rows);
    });
});

app.post('/api/buy', (req, res) => {
    const { telegram_id, product_id } = req.body;
    
    db.get(`SELECT * FROM users WHERE telegram_id = ?`, [telegram_id], (err, user) => {
        db.get(`SELECT * FROM products WHERE id = ?`, [product_id], (err, product) => {
            if (!user || !product) return res.json({ success: false, message: 'Dữ liệu không hợp lệ!' });
            if (user.balance < product.price) return res.json({ success: false, message: 'Số dư không đủ để mua!' });

            db.get(`SELECT * FROM keys WHERE product_id = ? AND is_sold = 0 LIMIT 1`, [product_id], (err, keyItem) => {
                if (!keyItem) return res.json({ success: false, message: 'Sản phẩm đã hết hàng!' });

                const newBalance = user.balance - product.price;
                db.run(`UPDATE users SET balance = ? WHERE telegram_id = ?`, [newBalance, telegram_id]);
                db.run(`UPDATE keys SET is_sold = 1 WHERE id = ?`, [keyItem.id]);
                db.run(`INSERT INTO orders (telegram_id, product_name, key_content, price) VALUES (?, ?, ?, ?)`, 
                    [telegram_id, product.name, keyItem.key_content, product.price]);

                bot.telegram.sendMessage(telegram_id, `🎉 Mua hàng thành công!\n📦 Sản phẩm: ${product.name}\n🔑 Key: <code>${keyItem.key_content}</code>`, { parse_mode: 'HTML' });

                res.json({ success: true, key: keyItem.key_content });
            });
        });
    });
});

// Yêu cầu nạp tiền -> Tự động gửi thông báo kèm Inline Button về chat của Admin
app.post('/api/deposit', (req, res) => {
    const { telegram_id, amount } = req.body;
    db.run(`INSERT INTO deposits (telegram_id, amount, status) VALUES (?, ?, 'PENDING')`, [telegram_id, amount], function(err) {
        if (err) return res.json({ success: false });
        
        const depositId = this.lastID;
        // Gửi tin nhắn về Telegram Bot cho Admin kèm nút bấm màu sắc trực quan
        bot.telegram.sendMessage(ADMIN_ID, 
            `🔔 <b>CÓ YÊU CẦU NẠP TIỀN MỚI!</b>\n\n👤 User ID: <code>${telegram_id}</code>\n💰 Số tiền: <b>${amount.toLocaleString()} VNĐ</b>`, 
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback(`✅ Duyệt ngay (${amount.toLocaleString()}đ)`, `approve_deposit_${depositId}_${telegram_id}_${amount}`)]
                ])
            }
        );
        res.json({ success: true });
    });
});

app.get('/api/settings', (req, res) => {
    db.all(`SELECT * FROM settings`, [], (err, rows) => {
        const settings = {};
        rows.forEach(r => settings[r.key] = r.value);
        res.json(settings);
    });
});

// --- ADMIN APIs ---
app.get('/api/admin/deposits', restrictToLocalhost, (req, res) => {
    db.all(`SELECT * FROM deposits WHERE status = 'PENDING' ORDER BY id DESC`, [], (err, rows) => {
        res.json(rows);
    });
});

app.post('/api/admin/deposit/approve', restrictToLocalhost, (req, res) => {
    const { deposit_id, telegram_id, amount } = req.body;
    db.run(`UPDATE deposits SET status = 'APPROVED' WHERE id = ?`, [deposit_id]);
    db.run(`UPDATE users SET balance = balance + ? WHERE telegram_id = ?`, [amount, telegram_id], () => {
        bot.telegram.sendMessage(telegram_id, `✨ Tài khoản của bạn đã được cộng thêm ${amount.toLocaleString()} VNĐ từ giao dịch nạp tiền.`);
        res.json({ success: true });
    });
});

app.post('/api/admin/add-balance', restrictToLocalhost, (req, res) => {
    const { telegram_id, amount } = req.body;
    db.get(`SELECT * FROM users WHERE telegram_id = ?`, [telegram_id], (err, user) => {
        if (!user) {
            db.run(`INSERT INTO users (telegram_id, balance) VALUES (?, ?)`, [telegram_id, amount]);
        } else {
            db.run(`UPDATE users SET balance = balance + ? WHERE telegram_id = ?`, [amount, telegram_id]);
        }
        bot.telegram.sendMessage(telegram_id, `💳 Admin đã cộng vào tài khoản của bạn: ${amount.toLocaleString()} VNĐ.`);
        res.json({ success: true });
    });
});

app.post('/api/admin/product/add', restrictToLocalhost, (req, res) => {
    const { name, price, description } = req.body;
    db.run(`INSERT INTO products (name, price, description) VALUES (?, ?, ?)`, [name, price, description], () => {
        res.json({ success: true });
    });
});

app.delete('/api/admin/product/:id', restrictToLocalhost, (req, res) => {
    db.run(`DELETE FROM products WHERE id = ?`, [req.params.id], () => {
        db.run(`DELETE FROM keys WHERE product_id = ?`, [req.params.id]);
        res.json({ success: true });
    });
});

app.get('/api/admin/keys/:product_id', restrictToLocalhost, (req, res) => {
    db.all(`SELECT * FROM keys WHERE product_id = ?`, [req.params.product_id], (err, rows) => {
        res.json(rows);
    });
});

app.post('/api/admin/key/add', restrictToLocalhost, (req, res) => {
    const { product_id, keys } = req.body;
    const keyList = keys.split('\n').filter(k => k.trim() !== '');
    const stmt = db.prepare(`INSERT INTO keys (product_id, key_content) VALUES (?, ?)`);
    keyList.forEach(k => stmt.run(product_id, k.trim()));
    stmt.finalize();
    res.json({ success: true });
});

app.delete('/api/admin/key/:id', restrictToLocalhost, (req, res) => {
    db.run(`DELETE FROM keys WHERE id = ?`, [req.params.id], () => {
        res.json({ success: true });
    });
});

app.post('/api/admin/settings', restrictToLocalhost, (req, res) => {
    const { bank_qr } = req.body;
    db.run(`INSERT INTO settings (key, value) VALUES ('bank_qr', ?) ON CONFLICT(key) DO UPDATE SET value = ?`, [bank_qr, bank_qr], () => {
        res.json({ success: true });
    });
});

app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
