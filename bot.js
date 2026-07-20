/**
 * Sheger Bingo — Telegram Bot Handler
 * bot: @sheger_bingo_game_bot
 *
 * Setup:
 *   npm install
 *   cp .env.example .env   # fill in your values
 *   node bot.js
 */

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

/* ─── Config ─────────────────────────────────────────────── */
const TOKEN         = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;   // your personal Telegram ID
const MINI_APP_URL  = process.env.MINI_APP_URL;    // https://yourusername.github.io/sheger-bingo/

if (!TOKEN || !ADMIN_CHAT_ID || !MINI_APP_URL) {
  console.error('❌  Missing env vars. Copy .env.example → .env and fill values.');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });
console.log('✅  Sheger Bingo Bot is running…');

/* ─── Pending deposit requests (in-memory, keyed by requestId) ─ */
const pendingDeposits  = {};   // requestId → { userId, amount, method, ref, chatId }
const pendingWithdraws = {};   // requestId → { userId, amount, method, account, chatId }

/* ─── /start ─────────────────────────────────────────────── */
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const name   = msg.from.first_name || 'ተጫዋች';

  bot.sendMessage(chatId,
    `🎰 *እንኳን ደህና መጡ ${name}!*\n\nSheger Bingo — ካርቴላ ምረጡ፣ ይምዝገቡ፣ አሸናፊ ይሁኑ!\n\n💰 ሽልማት 75% ለአሸናፊ\n🏦 25% ለAdmin`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          {
            text: '🎮 ጨዋታ ይጀምሩ',
            web_app: { url: MINI_APP_URL }
          }
        ], [
          { text: '💰 ሒሳብ ይክፈሉ',     callback_data: 'deposit_info' },
          { text: '📊 Leaderboard',   callback_data: 'leaderboard'  }
        ]]
      }
    }
  );
});

/* ─── /help ──────────────────────────────────────────────── */
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `ℹ️ *Sheger Bingo እርዳታ*\n\n` +
    `/start  — Bot ይጀምሩ\n` +
    `/balance — ቀሪ ሒሳብ ይመልከቱ\n` +
    `/deposit — ቅድሚያ ሂደት\n` +
    `/withdraw — ገንዘብ ማውጣት\n\n` +
    `❓ ችግር ካለ @sheger_support ያነጋግሩ`,
    { parse_mode: 'Markdown' }
  );
});

/* ─── /balance ───────────────────────────────────────────── */
bot.onText(/\/balance/, (msg) => {
  // In production, query your database here.
  bot.sendMessage(msg.chat.id,
    `💰 *ቀሪ ሒሳብ*\n\nዝርዝር ለማየት ጨዋታ ውስጥ ➜ Settings ይጫኑ።`,
    { parse_mode: 'Markdown' }
  );
});

/* ─── /deposit info ──────────────────────────────────────── */
bot.onText(/\/deposit/, (msg) => {
  sendDepositInfo(msg.chat.id);
});

function sendDepositInfo(chatId) {
  bot.sendMessage(chatId,
    `💳 *ቅድሚያ ሒሳብ (Deposit)*\n\n` +
    `📱 *Telebirr:* \`+251964796846\`\n` +
    `👤 ስም: SUED MEBRAHTU\n\n` +
    `🏦 *CBE (ንግድ ባንክ):* \`1000615139126\`\n` +
    `👤 ስም: SIED MEBRAHTU\n\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `1️⃣ ወደ ላይ ወዳለው አካውንት ያስተላልፉ\n` +
    `2️⃣ Transaction ID ወስደው ጨዋታ ውስጥ Deposit ያረጋግጡ\n` +
    `3️⃣ Admin ካረጋገጡ ሒሳብዎ ይዘምናል`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '🎮 ጨዋታ ይጀምሩ', web_app: { url: MINI_APP_URL } }
        ]]
      }
    }
  );
}

/* ─── Web App Data (from Mini App sendData) ──────────────── */
bot.on('message', (msg) => {
  if (!msg.web_app_data) return;

  let data;
  try { data = JSON.parse(msg.web_app_data.data); }
  catch { return; }

  if (data.type === 'deposit_request')  handleDepositRequest(msg, data);
  if (data.type === 'withdraw_request') handleWithdrawRequest(msg, data);
});

/* ─── Deposit request ────────────────────────────────────── */
function handleDepositRequest(msg, data) {
  const chatId     = msg.chat.id;
  const userId     = msg.from.id;
  const userName   = msg.from.first_name || 'ያልታወቀ';
  const requestId  = `DEP-${userId}-${Date.now()}`;

  pendingDeposits[requestId] = {
    userId, chatId,
    amount: data.amount,
    method: data.method,
    ref:    data.ref
  };

  const methodLabel = data.method === 'telebirr'
    ? 'Telebirr (+251964796846)'
    : 'CBE (1000615139126)';

  /* Acknowledge user */
  bot.sendMessage(chatId,
    `✅ *Deposit ጥያቄ ተልኳል!*\n\n` +
    `💵 መጠን: *${data.amount} ብር*\n` +
    `🏦 ${methodLabel}\n` +
    `🔖 Ref: \`${data.ref}\`\n\n` +
    `⏳ Admin ካረጋገጡ ሒሳብዎ ይዘምናል (5–30 ደቂቃ).\n` +
    `📋 ጥያቄ ቁጥር: \`${requestId}\``,
    { parse_mode: 'Markdown' }
  );

  /* Notify admin */
  bot.sendMessage(ADMIN_CHAT_ID,
    `🔔 *አዲስ DEPOSIT ጥያቄ*\n\n` +
    `👤 ${userName} (ID: \`${userId}\`)\n` +
    `💵 *${data.amount} ብር*\n` +
    `🏦 ${methodLabel}\n` +
    `🔖 Ref: \`${data.ref}\`\n` +
    `📋 \`${requestId}\``,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ ያስቀምጡ (ያረጋግጡ)', callback_data: `approve_dep:${requestId}` },
          { text: '❌ አይቀበሉ',           callback_data: `reject_dep:${requestId}`  }
        ]]
      }
    }
  );
}

/* ─── Withdraw request ───────────────────────────────────── */
function handleWithdrawRequest(msg, data) {
  const chatId    = msg.chat.id;
  const userId    = msg.from.id;
  const userName  = msg.from.first_name || 'ያልታወቀ';
  const requestId = `WIT-${userId}-${Date.now()}`;

  pendingWithdraws[requestId] = {
    userId, chatId,
    amount:  data.amount,
    method:  data.method,
    account: data.account
  };

  const methodLabel = data.method === 'telebirr' ? 'Telebirr' : 'CBE';

  /* Acknowledge user */
  bot.sendMessage(chatId,
    `📤 *Withdraw ጥያቄ ተልኳል!*\n\n` +
    `💵 *${data.amount} ብር*\n` +
    `🏦 ${methodLabel}: \`${data.account}\`\n\n` +
    `⏳ Admin ካረጋገጡ ገንዘቡ ይደርስዎታል (5–60 ደቂቃ).\n` +
    `📋 ጥያቄ ቁጥር: \`${requestId}\``,
    { parse_mode: 'Markdown' }
  );

  /* Notify admin */
  bot.sendMessage(ADMIN_CHAT_ID,
    `🔔 *አዲስ WITHDRAW ጥያቄ*\n\n` +
    `👤 ${userName} (ID: \`${userId}\`)\n` +
    `💵 *${data.amount} ብር*\n` +
    `🏦 ${methodLabel}: \`${data.account}\`\n` +
    `📋 \`${requestId}\``,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ ተልኳል (ያረጋግጡ)', callback_data: `approve_wit:${requestId}` },
          { text: '❌ ይቅር',            callback_data: `reject_wit:${requestId}`  }
        ]]
      }
    }
  );
}

/* ─── Admin inline button callbacks ─────────────────────── */
bot.on('callback_query', (query) => {
  const adminId = String(query.from.id);
  if (adminId !== String(ADMIN_CHAT_ID)) {
    return bot.answerCallbackQuery(query.id, { text: 'ይህ ትዕዛዝ ለAdmin ብቻ ነው።' });
  }

  const [action, requestId] = query.data.split(':');

  /* ── Deposit approve ── */
  if (action === 'approve_dep') {
    const req = pendingDeposits[requestId];
    if (!req) return bot.answerCallbackQuery(query.id, { text: '⚠️ ጥያቄ አልተገኘም ወይም ፍቃዱ ቀድሞ ተሰጥቷል።' });
    delete pendingDeposits[requestId];

    bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id
    });
    bot.editMessageText(
      query.message.text + `\n\n✅ *ፍቃድ ተሰጥቷል* — ${new Date().toLocaleTimeString()}`,
      { chat_id: query.message.chat.id, message_id: query.message.message_id, parse_mode: 'Markdown' }
    );

    bot.sendMessage(req.chatId,
      `🎉 *Deposit ተረጋገጠ!*\n\n` +
      `💰 *${req.amount} ብር* ሒሳብዎ ላይ ተጨምሯል!\n` +
      `ጨዋታ ለመጀመር ቀጥሉ 👇`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '🎮 ጨዋታ ይጀምሩ', web_app: { url: MINI_APP_URL } }]] }
      }
    );
    bot.answerCallbackQuery(query.id, { text: `✅ ${req.amount} ብር ፍቃድ ተሰጥቷል!` });
  }

  /* ── Deposit reject ── */
  else if (action === 'reject_dep') {
    const req = pendingDeposits[requestId];
    if (!req) return bot.answerCallbackQuery(query.id, { text: '⚠️ ጥያቄ አልተገኘም።' });
    delete pendingDeposits[requestId];

    bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id
    });

    bot.sendMessage(req.chatId,
      `❌ *Deposit አልተቀበለም*\n\n` +
      `Ref: \`${req.ref}\`\n\n` +
      `ችግር ካለ Admin ያነጋግሩ።`,
      { parse_mode: 'Markdown' }
    );
    bot.answerCallbackQuery(query.id, { text: '❌ ተወዷል።' });
  }

  /* ── Withdraw approve ── */
  else if (action === 'approve_wit') {
    const req = pendingWithdraws[requestId];
    if (!req) return bot.answerCallbackQuery(query.id, { text: '⚠️ ጥያቄ አልተገኘም።' });
    delete pendingWithdraws[requestId];

    bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id
    });

    bot.sendMessage(req.chatId,
      `💸 *Withdraw ተፈጸመ!*\n\n` +
      `💵 *${req.amount} ብር* ወደ \`${req.account}\` ተላልፏል!\n` +
      `ለ5–15 ደቂቃ ውስጥ ይደርስዎታል።`,
      { parse_mode: 'Markdown' }
    );
    bot.answerCallbackQuery(query.id, { text: `✅ ${req.amount} ብር ተልኳል!` });
  }

  /* ── Withdraw reject ── */
  else if (action === 'reject_wit') {
    const req = pendingWithdraws[requestId];
    if (!req) return bot.answerCallbackQuery(query.id, { text: '⚠️ ጥያቄ አልተገኘም።' });
    delete pendingWithdraws[requestId];

    bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id
    });

    bot.sendMessage(req.chatId,
      `❌ *Withdraw ጥያቄ አልተቀበለም*\n\n` +
      `ምክንያት: ቀሪ ሒሳብ ወይም ሌላ ችግር።\n` +
      `ዝርዝር ለAdmin ያነጋግሩ።`,
      { parse_mode: 'Markdown' }
    );
    bot.answerCallbackQuery(query.id, { text: '❌ ተወዷል።' });
  }

  /* ── Info buttons ── */
  else if (action === 'deposit_info') {
    sendDepositInfo(query.message.chat.id);
    bot.answerCallbackQuery(query.id);
  }
  else if (action === 'leaderboard') {
    bot.sendMessage(query.message.chat.id,
      `📊 *Leaderboard*\n\n🥇 Sami — 12 wins\n🥈 Tigist — 9 wins\n🥉 Enoch — 8 wins\n\nሙሉ ዝርዝር ጨዋታ ውስጥ Menu ➜ ቀዳሚ ተጫዋቾች`,
      { parse_mode: 'Markdown' }
    );
    bot.answerCallbackQuery(query.id);
  }
});

/* ─── Error handling ─────────────────────────────────────── */
bot.on('polling_error', (err) => {
  console.error('Polling error:', err.message);
});

process.on('SIGINT',  () => { bot.stopPolling(); process.exit(0); });
process.on('SIGTERM', () => { bot.stopPolling(); process.exit(0); });
