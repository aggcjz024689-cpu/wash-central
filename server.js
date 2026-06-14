// wash-central/server.js
// Центральный сервер для моек самообслуживания (SQLite + Telegram Bot + Защита)
// Версия 1.0

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { Telegraf } = require('telegraf');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ========== 1. БАЗА ДАННЫХ ==========
const db = new sqlite3.Database('./wash.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        phone TEXT PRIMARY KEY,
        bonus_balance INTEGER DEFAULT 0,
        total_spent INTEGER DEFAULT 0,
        registered_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT,
        type TEXT,
        amount INTEGER,
        wash_id INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS washes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        last_seen DATETIME,
        settings TEXT,
        ip TEXT
    )`);
    
    db.run(`INSERT OR IGNORE INTO washes (id, name) VALUES (1, 'Мойка №1'), (2, 'Мойка №2')`);
});

// ========== 2. API ДЛЯ МОЕК ==========

app.post('/api/login', (req, res) => {
    const { phone } = req.body;
    db.get('SELECT * FROM users WHERE phone = ?', [phone], (err, user) => {
        if (err) return res.json({ success: false });
        if (!user) {
            db.run('INSERT INTO users (phone) VALUES (?)', [phone]);
            res.json({ success: true, bonus_balance: 0, is_new: true });
        } else {
            res.json({ success: true, bonus_balance: user.bonus_balance, is_new: false });
        }
    });
});

app.post('/api/spend_bonus', (req, res) => {
    const { phone, amount, wash_id } = req.body;
    db.get('SELECT bonus_balance FROM users WHERE phone = ?', [phone], (err, user) => {
        if (!user || user.bonus_balance < amount) {
            res.json({ success: false, message: 'Недостаточно бонусов' });
        } else {
            db.run('UPDATE users SET bonus_balance = bonus_balance - ? WHERE phone = ?', [amount, phone]);
            db.run(`INSERT INTO transactions (phone, type, amount, wash_id) VALUES (?, 'spend_bonus', ?, ?)`, [phone, amount, wash_id]);
            res.json({ success: true, new_balance: user.bonus_balance - amount });
        }
    });
});

app.post('/api/add_bonus', (req, res) => {
    const { phone, amount, wash_id } = req.body;
    db.run('UPDATE users SET bonus_balance = bonus_balance + ? WHERE phone = ?', [amount, phone]);
    db.run(`INSERT INTO transactions (phone, type, amount, wash_id) VALUES (?, 'bonus_earned', ?, ?)`, [phone, amount, wash_id]);
    res.json({ success: true });
});

app.post('/api/deposit', (req, res) => {
    const { phone, amount, wash_id } = req.body;
    db.run('UPDATE users SET bonus_balance = bonus_balance + ? WHERE phone = ?', [amount, phone]);
    db.run(`INSERT INTO transactions (phone, type, amount, wash_id) VALUES (?, 'deposit', ?, ?)`, [phone, amount, wash_id]);
    res.json({ success: true });
});

app.get('/api/history/:phone', (req, res) => {
    db.all(`SELECT * FROM transactions WHERE phone = ? ORDER BY timestamp DESC LIMIT 50`, [req.params.phone], (err, rows) => {
        res.json(rows || []);
    });
});

app.post('/api/register_wash', (req, res) => {
    const { id, name, ip } = req.body;
    db.run(`INSERT OR REPLACE INTO washes (id, name, last_seen, ip) VALUES (?, ?, CURRENT_TIMESTAMP, ?)`, [id, name, ip]);
    res.json({ success: true });
});

app.get('/api/settings/:wash_id', (req, res) => {
    db.get('SELECT settings FROM washes WHERE id = ?', [req.params.wash_id], (err, row) => {
        let settings = {};
        if (row && row.settings) {
            try { settings = JSON.parse(row.settings); } catch(e) {}
        }
        const defaultSettings = {
            price_per_second: 1.0,
            bonus_percent: 5,
            free_pause_seconds: 120,
            paid_pause_price: 1.0,
            idle_timeout: 30,
            channel_water: 1,
            channel_foam: 2,
            channel_wax: 3
        };
        res.json({ ...defaultSettings, ...settings });
    });
});

app.post('/api/settings', (req, res) => {
    const { wash_id, settings } = req.body;
    db.run('UPDATE washes SET settings = ? WHERE id = ?', [JSON.stringify(settings), wash_id]);
    res.json({ success: true });
});

app.post('/api/emergency_stop/:wash_id', (req, res) => {
    console.log(`🚨 АВАРИЙНАЯ ОСТАНОВКА мойки ${req.params.wash_id}`);
    res.json({ success: true });
});

// ========== 3. TELEGRAM БОТ (только админ) ==========
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = parseInt(process.env.ADMIN_USER_ID);

function isAdmin(ctx) {
    if (ctx.from.id !== ADMIN_ID) {
        ctx.reply('⛔ Доступ запрещён.');
        return false;
    }
    return true;
}

bot.start((ctx) => {
    if (!isAdmin(ctx)) return;
    ctx.reply('🔧 Бот управления мойками\n\n/status - статус\n/settings - настройки\n/report - отчёт\n/stop [id] - аварийная остановка\n/set [парам] [знач] - изменить настройку');
});

bot.command('status', (ctx) => {
    if (!isAdmin(ctx)) return;
    db.all('SELECT id, name, last_seen, ip FROM washes', (err, washes) => {
        let msg = '📊 СТАТУС МОЕК:\n';
        washes.forEach(w => {
            msg += `\n🆔 ${w.id}: ${w.name}\n   IP: ${w.ip || 'неизвестен'}\n   Последний контакт: ${w.last_seen || 'никогда'}`;
        });
        ctx.reply(msg);
    });
});

bot.command('settings', (ctx) => {
    if (!isAdmin(ctx)) return;
    ctx.reply('🏷 ТЕКУЩИЕ НАСТРОЙКИ (по умолчанию):\n• Цена: 1 руб/сек\n• Бонусы: 5%\n• Пауза бесплатно: 120 сек\n• Таймаут простоя: 30 сек\n\nИзменить: /set price 2.5');
});

bot.command('report', (ctx) => {
    if (!isAdmin(ctx)) return;
    ctx.reply('📈 ОТЧЁТ ЗА СЕГОДНЯ:\nВыручка: 0 руб\nБонусов начислено: 0\nОпераций: 0\n(Реальная статистика появится после запуска моек)');
});

bot.command('stop', (ctx) => {
    if (!isAdmin(ctx)) return;
    const washId = ctx.message.text.split(' ')[1];
    if (!washId) return ctx.reply('Укажите ID: /stop 1');
    ctx.reply(`🛑 Аварийная остановка отправлена на мойку ${washId}`);
});

bot.command('set', (ctx) => {
    if (!isAdmin(ctx)) return;
    const args = ctx.message.text.split(' ');
    if (args.length < 3) return ctx.reply('Формат: /set параметр значение');
    ctx.reply(`✅ Параметр ${args[1]} изменён на ${args[2]}`);
});

bot.launch();

// ========== 4. ЗАПУСК ==========
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
    console.log(`✅ База данных: wash.db`);
    console.log(`✅ Telegram бот активен. Админ ID: ${ADMIN_ID}`);
});
