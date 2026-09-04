const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const http = require('http');

// --- CẤU HÌNH BOT VÀ ADMIN ---
const BOT_TOKEN = '8774262600:AAẦcG0dGDWHJjWpHimRErS9vVbWQj82TdNY';
const ADMIN_ID = 8647955563;
const PORT = 3000;

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const server = http.createServer(app);

app.use(express.json());

// ==========================================
// PHẦN 1: GIAO DIỆN HTML (FRONTEND TÍCH HỢP ALL-IN-ONE)
// ==========================================
const HTML_CONTENT = `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Telegram Mini App - Shop</title>
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-pink-50/50 text-slate-800 pb-20">
    <script>
        const CONFIG = { ADMIN_ID: ${ADMIN_ID} };
    </script>

    <!-- Toast Notification Container -->
    <div id="toast-container" class="fixed top-4 right-4 left-4 z-50 flex flex-col space-y-2 pointer-events-none"></div>

    <div class="max-w-md mx-auto p-4">
        <!-- Header thông tin tài khoản -->
        <div class="bg-white p-4 rounded-2xl shadow-sm border border-pink-100 mb-4 flex justify-between items-center">
            <div>
                <p class="text-xs text-slate-400">Telegram ID: <span id="lbl-id" class="font-bold text-slate-600">...</span></p>
                <p class="text-lg font-extrabold text-pink-600"><span id="lbl-balance">0</span> VNĐ</p>
            </div>
            <!-- Nút Admin Panel (Ẩn nếu không phải admin) -->
            <button id="btn-admin-tab" onclick="switchTab('admin')" class="hidden bg-gradient-to-r from-pink-500 to-rose-500 text-white px-3 py-1.5 rounded-xl text-xs font-semibold shadow-md shadow-pink-200 hover:opacity-90 transition">🛡️ Admin Panel</button>
        </div>

        <!-- Thanh điều hướng Tab -->
        <div class="flex bg-pink-100/70 rounded-2xl shadow-sm mb-4 p-1 text-sm font-medium text-center">
            <button onclick="switchTab('shop')" class="flex-1 py-2 rounded-xl bg-white text-pink-600 font-bold shadow-sm transition" id="tab-shop">Sản phẩm</button>
            <button onclick="switchTab('deposit')" class="flex-1 py-2 rounded-xl text-slate-600 hover:text-pink-600 transition" id="tab-deposit">Nạp tiền</button>
            <button onclick="switchTab('history')" class="flex-1 py-2 rounded-xl text-slate-600 hover:text-pink-600 transition" id="tab-history">Đã mua</button>
        </div>

        <!-- Tab 1: Sản phẩm -->
        <div id="section-shop" class="space-y-3">
            <div id="product-list" class="space-y-3"></div>
        </div>

        <!-- Tab 2: Nạp tiền -->
        <div id="section-deposit" class="hidden space-y-4 bg-white p-4 rounded-2xl shadow-sm border border-pink-100">
            <h2 class="font-bold text-base text-pink-600">💖 Nạp tiền vào tài khoản cá nhân</h2>
            <div class="text-center bg-pink-50/50 p-3 rounded-xl border border-pink-100">
                <img id="bank-qr-img" src="" alt="Chưa cấu hình QR" class="mx-auto w-48 h-48 object-cover rounded-lg border border-pink-200 mb-2 bg-white">
                <p class="text-xs text-slate-500">Quét mã QR để chuyển khoản. Nội dung bắt buộc: <b id="transfer-syntax" class="text-pink-600 font-mono">NAP [ID]</b></p>
            </div>
            <div>
                <label class="block text-xs font-semibold mb-1 text-slate-600">Số tiền đã chuyển (VNĐ):</label>
                <input type="number" id="deposit-amount" class="w-full border border-pink-200 rounded-xl p-2.5 text-sm bg-pink-50/30 focus:bg-white focus:ring-2 focus:ring-pink-400 outline-none transition" placeholder="Nhập số tiền...">
            </div>
            <button onclick="requestDeposit()" class="w-full bg-pink-600 hover:bg-pink-700 text-white py-2.5 rounded-xl font-semibold text-sm shadow-md shadow-pink-200 transition">Gửi yêu cầu nạp tiền</button>
        </div>

        <!-- Tab 3: Lịch sử mua hàng -->
        <div id="section-history" class="hidden space-y-3">
            <div id="order-list" class="space-y-2"></div>
        </div>

        <!-- Tab 4: Admin Panel -->
        <div id="section-admin" class="hidden space-y-4 bg-white p-4 rounded-2xl shadow-sm border border-pink-100">
            <h2 class="font-bold text-pink-600 text-base border-b border-pink-100 pb-2">🛠️ Quản Trị Viên</h2>
            
            <div class="space-y-2 border-b border-pink-100 pb-3">
                <p class="text-xs font-bold text-slate-700">👥 Danh sách người dùng</p>
                <div id="admin-user-list" class="space-y-2 text-xs max-h-40 overflow-y-auto"></div>
            </div>

            <div class="space-y-2 border-b border-pink-100 pb-3">
                <p class="text-xs font-bold text-slate-700">🖼️ Đổi Link Ảnh QR Ngân Hàng</p>
                <input type="text" id="admin-bank-url" class="w-full border border-pink-200 rounded-xl p-2 text-xs outline-none focus:ring-1 focus:ring-pink-400" placeholder="Dán link ảnh QR...">
                <button onclick="updateBankQR()" class="bg-pink-600 hover:bg-pink-700 text-white text-xs px-3 py-1.5 rounded-xl transition">Lưu Ảnh</button>
            </div>

            <div class="space-y-2 border-b border-pink-100 pb-3">
                <p class="text-xs font-bold text-slate-700">💰 Duyệt nạp tiền chờ xử lý</p>
                <div id="admin-deposit-list" class="space-y-2 text-xs max-h-40 overflow-y-auto"></div>
            </div>

            <div class="space-y-2 border-b border-pink-100 pb-3">
                <p class="text-xs font-bold text-slate-700">➕ Cộng tiền thủ công</p>
                <input type="number" id="adm-user-id" class="w-full border border-pink-200 rounded-xl p-2 text-xs outline-none focus:ring-1 focus:ring-pink-400" placeholder="Telegram ID">
                <input type="number" id="adm-user-amount" class="w-full border border-pink-200 rounded-xl p-2 text-xs outline-none focus:ring-1 focus:ring-pink-400" placeholder="Số tiền VNĐ">
                <button onclick="adminAddBalance()" class="bg-pink-600 hover:bg-pink-700 text-white text-xs px-3 py-1.5 rounded-xl transition">Cộng tiền</button>
            </div>

            <div class="space-y-2 border-b border-pink-100 pb-3">
                <p class="text-xs font-bold text-slate-700">➕ Thêm sản phẩm mới</p>
                <input type="text" id="adm-prod-name" class="w-full border border-pink-200 rounded-xl p-2 text-xs outline-none focus:ring-1 focus:ring-pink-400" placeholder="Tên sản phẩm">
                <input type="number" id="adm-prod-price" class="w-full border border-pink-200 rounded-xl p-2 text-xs outline-none focus:ring-1 focus:ring-pink-400" placeholder="Giá tiền (VNĐ)">
                <textarea id="adm-prod-desc" class="w-full border border-pink-200 rounded-xl p-2 text-xs outline-none focus:ring-1 focus:ring-pink-400" placeholder="Mô tả"></textarea>
                <button onclick="adminAddProduct()" class="bg-pink-600 hover:bg-pink-700 text-white text-xs px-3 py-1.5 rounded-xl transition">Tạo sản phẩm</button>
            </div>

            <div id="admin-product-management" class="space-y-3 max-h-96 overflow-y-auto"></div>
        </div>
    </div>

    <script>
        const tg = window.Telegram.WebApp;
        tg.expand();

        const urlParams = new URLSearchParams(window.location.search);
        const telegramId = tg.initDataUnsafe?.user?.id || urlParams.get('id') || ${ADMIN_ID};

        document.getElementById('lbl-id').innerText = telegramId;
        document.getElementById('transfer-syntax').innerText = \`NAP \${telegramId}\`;

        let currentUser = {};

        function showToast(message, type = 'success') {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            let bg = 'bg-gradient-to-r from-pink-500 to-rose-500 text-white';
            let icon = '💖';
            if(type === 'error') { bg = 'bg-gradient-to-r from-rose-500 to-red-600 text-white'; icon = '⚠️'; }
            if(type === 'admin') { bg = 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'; icon = '🛡️'; }

            toast.className = \`pointer-events-auto \${bg} px-4 py-3 rounded-2xl shadow-lg flex items-center space-x-3 transform translate-y-[-20px] opacity-0 transition-all duration-300\`;
            toast.innerHTML = \`<span class="text-xl">\${icon}</span> <div class="text-xs font-medium">\${message}</div>\`;
            container.appendChild(toast);
            setTimeout(() => toast.classList.remove('translate-y-[-20px]', 'opacity-0'), 10);
            setTimeout(() => {
                toast.classList.add('translate-y-[-20px]', 'opacity-0');
                setTimeout(() => toast.remove(), 300);
            }, 4000);
        }

        async function initData() {
            const res = await fetch(\`/api/user/\${telegramId}\`);
            currentUser = await res.json();
            if (Number(telegramId) === CONFIG.ADMIN_ID) currentUser.isAdmin = true;

            document.getElementById('lbl-balance').innerText = currentUser.balance.toLocaleString();
            if (currentUser.isAdmin) {
                document.getElementById('btn-admin-tab').classList.remove('hidden');
            }
            loadProducts();
            loadSettings();
        }

        async function loadProducts() {
            const res = await fetch('/api/products');
            const products = await res.json();
            document.getElementById('product-list').innerHTML = products.map(p => \`
                <div class="bg-white p-4 rounded-2xl shadow-sm border border-pink-100 flex justify-between items-center">
                    <div>
                        <h3 class="font-bold text-sm text-slate-700">\${p.name}</h3>
                        <p class="text-xs text-slate-400 mt-0.5">\${p.description || ''}</p>
                        <p class="text-xs font-bold text-pink-600 mt-1">\${p.price.toLocaleString()} VNĐ <span class="text-slate-400 font-normal">| Kho: \${p.stock}</span></p>
                    </div>
                    <button onclick="buyProduct(\${p.id})" class="bg-pink-50 hover:bg-pink-600 text-pink-600 hover:text-white text-xs px-4 py-2 rounded-xl font-semibold border border-pink-200 transition">Mua</button>
                </div>
            \`).join('');
        }

        async function buyProduct(productId) {
            if(!confirm('Xác nhận mua sản phẩm này?')) return;
            const res = await fetch('/api/buy', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ telegram_id: telegramId, product_id: productId })
            });
            const data = await res.json();
            if (data.success) {
                showToast('Mua hàng thành công! Key đã được gửi về chat bot Telegram.');
                initData();
            } else {
                showToast(data.message, 'error');
            }
        }

        async function loadSettings() {
            const res = await fetch('/api/settings');
            const settings = await res.json();
            if(settings.bank_qr) {
                document.getElementById('bank-qr-img').src = settings.bank_qr;
                document.getElementById('admin-bank-url').value = settings.bank_qr;
            }
        }

        async function requestDeposit() {
            const amount = document.getElementById('deposit-amount').value;
            if(!amount || amount <= 0) return showToast('Nhập số tiền hợp lệ!', 'error');
            await fetch('/api/deposit', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ telegram_id: telegramId, amount: Number(amount) })
            });
            showToast('Đã gửi yêu cầu nạp tiền tới Admin!');
            document.getElementById('deposit-amount').value = '';
        }

        async function loadHistory() {
            const res = await fetch(\`/api/orders/\${telegramId}\`);
            const orders = await res.json();
            document.getElementById('order-list').innerHTML = orders.length === 0 ? '<p class="text-center text-xs text-slate-400 py-4">Chưa có lịch sử mua hàng.</p>' : orders.map(o => \`
                <div class="bg-white p-3 rounded-2xl shadow-sm border border-pink-100 text-xs space-y-1">
                    <div class="flex justify-between font-bold">
                        <span class="text-slate-700">\${o.product_name}</span>
                        <span class="text-pink-600">\${o.price.toLocaleString()} VNĐ</span>
                    </div>
                    <p class="text-slate-500">Key: <code class="bg-pink-50 text-pink-700 px-1.5 py-0.5 rounded border border-pink-100 select-all font-mono">\${o.key_content}</code></p>
                    <p class="text-[10px] text-slate-400">\${o.created_at}</p>
                </div>
            \`).join('');
        }

        async function loadAdminData() {
            const headers = { 'Admin-ID': telegramId };

            const resUsers = await fetch('/api/admin/users', { headers });
            const users = await resUsers.json();
            document.getElementById('admin-user-list').innerHTML = users.map(u => \`
                <div class="flex justify-between items-center bg-pink-50/50 p-2 rounded-xl border border-pink-100">
                    <span>ID: <b>\${u.telegram_id}</b></span>
                    <span class="font-bold text-pink-600">\${u.balance.toLocaleString()} VNĐ</span>
                </div>
            \`).join('');

            const resDep = await fetch('/api/admin/deposits', { headers });
            const deps = await resDep.json();
            document.getElementById('admin-deposit-list').innerHTML = deps.length === 0 ? '<p class="text-slate-400 italic">Không có yêu cầu nạp nào.</p>' : deps.map(d => \`
                <div class="flex justify-between items-center bg-pink-50/50 p-2 rounded-xl border border-pink-100">
                    <span>ID: <b>\${d.telegram_id}</b> - <b class="text-pink-600">\${d.amount.toLocaleString()}đ</b></span>
                    <button onclick="approveDeposit(\${d.id}, \${d.telegram_id}, \${d.amount})" class="bg-pink-600 hover:bg-pink-700 text-white px-2.5 py-1 rounded-lg transition">Duyệt</button>
                </div>
            \`).join('');

            const resProd = await fetch('/api/products');
            const prods = await resProd.json();
            document.getElementById('admin-product-management').innerHTML = \`
                <p class="text-xs font-bold text-slate-700 pt-2 border-t border-pink-100">📦 Quản lý kho Key</p>
                \${prods.map(p => \`
                    <div class="bg-pink-50/40 p-3 rounded-xl border border-pink-100 text-xs space-y-2">
                        <div class="flex justify-between font-bold items-center">
                            <span class="text-pink-600">\${p.name} (Kho: \${p.stock})</span>
                            <button onclick="deleteProduct(\${p.id})" class="text-rose-500 hover:underline">Xoá</button>
                        </div>
                        <textarea id="keys-input-\${p.id}" class="w-full border border-pink-200 rounded-xl p-2 bg-white outline-none" placeholder="Mỗi dòng 1 key..."></textarea>
                        <button onclick="addKeys(\${p.id})" class="bg-slate-700 hover:bg-slate-800 text-white px-3 py-1.5 rounded-xl transition">Thêm Key</button>
                    </div>
                \`).join('')}
            \`;
        }

        async function approveDeposit(id, telegramIdTarget, amount) {
            await fetch('/api/admin/deposit/approve', {
                method: 'POST',
                headers: {'Content-Type': 'application/json', 'Admin-ID': telegramId},
                body: JSON.stringify({ deposit_id: id, telegram_id: telegramIdTarget, amount: amount })
            });
            showToast('Đã duyệt thành công!');
            loadAdminData();
        }

        async function adminAddBalance() {
            const uid = document.getElementById('adm-user-id').value;
            const amt = document.getElementById('adm-user-amount').value;
            if(!uid || !amt) return showToast('Nhập đủ ID và số tiền!', 'error');
            await fetch('/api/admin/add-balance', {
                method: 'POST',
                headers: {'Content-Type': 'application/json', 'Admin-ID': telegramId},
                body: JSON.stringify({ telegram_id: Number(uid), amount: Number(amt) })
            });
            showToast('Cộng tiền thành công!');
            document.getElementById('adm-user-id').value = '';
            document.getElementById('adm-user-amount').value = '';
            loadAdminData();
        }

        async function adminAddProduct() {
            const name = document.getElementById('adm-prod-name').value;
            const price = document.getElementById('adm-prod-price').value;
            const description = document.getElementById('adm-prod-desc').value;
            if(!name || !price) return showToast('Nhập tên và giá!', 'error');
            await fetch('/api/admin/product/add', {
                method: 'POST',
                headers: {'Content-Type': 'application/json', 'Admin-ID': telegramId},
                body: JSON.stringify({ name, price: Number(price), description })
            });
            showToast('Thêm sản phẩm thành công!');
            document.getElementById('adm-prod-name').value = '';
            document.getElementById('adm-prod-price').value = '';
            document.getElementById('adm-prod-desc').value = '';
            loadAdminData();
            loadProducts();
        }

        async function deleteProduct(id) {
            if(!confirm('Xoá sản phẩm này?')) return;
            await fetch(\`/api/admin/product/\${id}\`, { method: 'DELETE', headers: { 'Admin-ID': telegramId } });
            showToast('Đã xoá!');
            loadAdminData();
            loadProducts();
        }

        async function addKeys(productId) {
            const keys = document.getElementById(\`keys-input-\${productId}\`).value;
            if(!keys.trim()) return showToast('Nhập nội dung key!', 'error');
            await fetch('/api/admin/key/add', {
                method: 'POST',
                headers: {'Content-Type': 'application/json', 'Admin-ID': telegramId},
                body: JSON.stringify({ product_id: productId, keys })
            });
            showToast('Thêm key thành công!');
            document.getElementById(\`keys-input-\${productId}\`).value = '';
            loadProducts();
            loadAdminData();
        }

        async function updateBankQR() {
            const bank_qr = document.getElementById('admin-bank-url').value;
            await fetch('/api/admin/settings', {
                method: 'POST',
                headers: {'Content-Type': 'application/json', 'Admin-ID': telegramId},
                body: JSON.stringify({ bank_qr })
            });
            showToast('Cập nhật QR thành công!');
            loadSettings();
        }

        function switchTab(tab) {
            ['shop', 'deposit', 'history', 'admin'].forEach(t => {
                document.getElementById(\`section-\${t}\`).classList.add('hidden');
                const btn = document.getElementById(\`tab-\${t}\`);
                if(btn) btn.className = "flex-1 py-2 rounded-xl text-slate-600 hover:text-pink-600 transition";
            });
            document.getElementById(\`section-\${tab}\`).classList.remove('hidden');
            if(tab !== 'admin') {
                const btn = document.getElementById(\`tab-\${tab}\`);
                if(btn) btn.className = "flex-1 py-2 rounded-xl bg-white text-pink-600 font-bold shadow-sm transition";
            } else {
                loadAdminData();
            }
            if(tab === 'history') loadHistory();
        }

        initData();
    </script>
</body>
</html>`;

// ==========================================
// PHẦN 2: DATABASE SQLITE & BACKEND SERVER
// ==========================================
const db = new sqlite3.Database('data.db', (err) => {
    if (err) console.error('Lỗi SQLite:', err.message);
    else console.log('Đã kết nối cơ sở dữ liệu SQLite.');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (telegram_id INTEGER PRIMARY KEY, balance INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    db.run(`CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, price INTEGER, description TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS keys (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER, key_content TEXT, is_sold INTEGER DEFAULT 0)`);
    db.run(`CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, telegram_id INTEGER, product_name TEXT, key_content TEXT, price INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    db.run(`CREATE TABLE IF NOT EXISTS deposits (id INTEGER PRIMARY KEY AUTOINCREMENT, telegram_id INTEGER, amount INTEGER, status TEXT DEFAULT 'PENDING', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    db.run(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`);
});

// --- TELEGRAM BOT ROUTING ---
bot.start((ctx) => {
    const userId = ctx.from.id;
    db.get(`SELECT * FROM users WHERE telegram_id = ?`, [userId], (err, row) => {
        if (!row) db.run(`INSERT INTO users (telegram_id, balance) VALUES (?, 0)`, [userId]);
    });

    const webAppUrl = `http://localhost:${PORT}?id=${userId}`;
    ctx.reply(`🌸 Chào mừng bạn đến với Cửa hàng!\nID Telegram của bạn là: <code>${userId}</code>`, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [[{ text: '💖 Mở Cửa Hàng (Mini App)', web_app: { url: webAppUrl } }]]
        }
    });
});

bot.action(/^approve_deposit_(\d+)_(\d+)_(\d+)$/, async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery('Không có quyền!');
    const depositId = ctx.match[1];
    const telegramId = ctx.match[2];
    const amount = Number(ctx.match[3]);

    db.get(`SELECT * FROM deposits WHERE id = ? AND status = 'PENDING'`, [depositId], (err, dep) => {
        if (!dep) return ctx.answerCbQuery('Đã duyệt trước đó hoặc không tồn tại!');
        db.run(`UPDATE deposits SET status = 'APPROVED' WHERE id = ?`, [depositId]);
        db.run(`UPDATE users SET balance = balance + ? WHERE telegram_id = ?`, [amount, telegramId], () => {
            bot.telegram.sendMessage(telegramId, `✨ Tài khoản đã được cộng ${amount.toLocaleString()} VNĐ từ nạp tiền!`);
            ctx.editMessageText(`✅ Đã DUYỆT nạp tiền ID: <b>${telegramId}</b> - Số tiền: <b>${amount.toLocaleString()}đ</b>`, { parse_mode: 'HTML' });
            ctx.answerCbQuery('Thành công!');
        });
    });
});

bot.launch().then(() => console.log('🤖 Bot Telegram đã khởi động thành công!'));

// --- API ENDPOINTS ---
app.get('/', (req, res) => res.send(HTML_CONTENT));

app.get('/api/user/:id', (req, res) => {
    const userId = req.params.id;
    db.get(`SELECT * FROM users WHERE telegram_id = ?`, [userId], (err, row) => {
        if (!row) {
            db.run(`INSERT INTO users (telegram_id, balance) VALUES (?, 0)`, [userId], () => {
                res.json({ telegram_id: userId, balance: 0, isAdmin: Number(userId) === ADMIN_ID });
            });
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
    db.all(`SELECT * FROM orders WHERE telegram_id = ? ORDER BY id DESC`, [req.params.id], (err, rows) => res.json(rows));
});

app.post('/api/buy', (req, res) => {
    const { telegram_id, product_id } = req.body;
    db.get(`SELECT * FROM users WHERE telegram_id = ?`, [telegram_id], (err, user) => {
        db.get(`SELECT * FROM products WHERE id = ?`, [product_id], (err, product) => {
            if (!user || !product) return res.json({ success: false, message: 'Dữ liệu không hợp lệ!' });
            if (user.balance < product.price) return res.json({ success: false, message: 'Số dư không đủ!' });

            db.get(`SELECT * FROM keys WHERE product_id = ? AND is_sold = 0 LIMIT 1`, [product_id], (err, keyItem) => {
                if (!keyItem) return res.json({ success: false, message: 'Sản phẩm đã hết hàng!' });

                db.run(`UPDATE users SET balance = balance - ? WHERE telegram_id = ?`, [product.price, telegram_id]);
                db.run(`UPDATE keys SET is_sold = 1 WHERE id = ?`, [keyItem.id]);
                db.run(`INSERT INTO orders (telegram_id, product_name, key_content, price) VALUES (?, ?, ?, ?)`, 
                    [telegram_id, product.name, keyItem.key_content, product.price]);

                bot.telegram.sendMessage(telegram_id, `🎉 Mua hàng thành công!\n📦 Sản phẩm: ${product.name}\n🔑 Key: <code>${keyItem.key_content}</code>`, { parse_mode: 'HTML' });
                res.json({ success: true, key: keyItem.key_content });
            });
        });
    });
});

app.post('/api/deposit', (req, res) => {
    const { telegram_id, amount } = req.body;
    db.run(`INSERT INTO deposits (telegram_id, amount, status) VALUES (?, ?, 'PENDING')`, [telegram_id, amount], function(err) {
        if (err) return res.json({ success: false });
        const depositId = this.lastID;
        bot.telegram.sendMessage(ADMIN_ID, 
            `🔔 <b>YÊU CẦU NẠP TIỀN MỚI!</b>\n\n👤 ID: <code>${telegram_id}</code>\n💰 Số tiền: <b>${amount.toLocaleString()} VNĐ</b>`, 
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([[Markup.button.callback(`✅ Duyệt (${amount.toLocaleString()}đ)`, `approve_deposit_${depositId}_${telegram_id}_${amount}`)]])
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

// --- ADMIN API & MIDDLEWARE ---
const checkAdmin = (req, res, next) => {
    if (Number(req.headers['admin-id']) !== ADMIN_ID) return res.status(403).json({ success: false, message: 'Từ chối truy cập!' });
    next();
};

app.get('/api/admin/users', checkAdmin, (req, res) => db.all(`SELECT * FROM users ORDER BY balance DESC`, [], (err, rows) => res.json(rows)));
app.get('/api/admin/deposits', checkAdmin, (req, res) => db.all(`SELECT * FROM deposits WHERE status = 'PENDING' ORDER BY id DESC`, [], (err, rows) => res.json(rows)));

app.post('/api/admin/deposit/approve', checkAdmin, (req, res) => {
    const { deposit_id, telegram_id, amount } = req.body;
    db.run(`UPDATE deposits SET status = 'APPROVED' WHERE id = ?`, [deposit_id]);
    db.run(`UPDATE users SET balance = balance + ? WHERE telegram_id = ?`, [amount, telegram_id], () => {
        bot.telegram.sendMessage(telegram_id, `✨ Tài khoản đã được cộng thêm ${amount.toLocaleString()} VNĐ.`);
        res.json({ success: true });
    });
});

app.post('/api/admin/add-balance', checkAdmin, (req, res) => {
    const { telegram_id, amount } = req.body;
    db.get(`SELECT * FROM users WHERE telegram_id = ?`, [telegram_id], (err, user) => {
        if (!user) db.run(`INSERT INTO users (telegram_id, balance) VALUES (?, ?)`, [telegram_id, amount]);
        else db.run(`UPDATE users SET balance = balance + ? WHERE telegram_id = ?`, [amount, telegram_id]);
        bot.telegram.sendMessage(telegram_id, `💳 Admin đã cộng vào tài khoản của bạn: ${amount.toLocaleString()} VNĐ.`);
        res.json({ success: true });
    });
});

app.post('/api/admin/product/add', checkAdmin, (req, res) => {
    const { name, price, description } = req.body;
    db.run(`INSERT INTO products (name, price, description) VALUES (?, ?, ?)`, [name, price, description], () => res.json({ success: true }));
});

app.delete('/api/admin/product/:id', checkAdmin, (req, res) => {
    db.run(`DELETE FROM products WHERE id = ?`, [req.params.id], () => {
        db.run(`DELETE FROM keys WHERE product_id = ?`, [req.params.id]);
        res.json({ success: true });
    });
});

app.post('/api/admin/key/add', checkAdmin, (req, res) => {
    const { product_id, keys } = req.body;
    const keyList = keys.split('\n').filter(k => k.trim() !== '');
    const stmt = db.prepare(`INSERT INTO keys (product_id, key_content) VALUES (?, ?)`);
    keyList.forEach(k => stmt.run(product_id, k.trim()));
    stmt.finalize();
    res.json({ success: true });
});

app.post('/api/admin/settings', checkAdmin, (req, res) => {
    const { bank_qr } = req.body;
    db.run(`INSERT INTO settings (key, value) VALUES ('bank_qr', ?) ON CONFLICT(key) DO UPDATE SET value = ?`, [bank_qr, bank_qr], () => res.json({ success: true }));
});

server.listen(PORT, () => {
    console.log(`🚀 Server chạy thành công tại http://localhost:${PORT}`);
});
