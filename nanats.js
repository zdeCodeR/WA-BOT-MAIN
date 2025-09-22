const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const config = require('./config');
const fs = require('fs');
const moment = require('moment');
const VERCEL_TOKEN = 'uHvtGKd0sGkFTtk8xJMlbBOo';
const ADMIN_LINK = 'https://t.me/nanastfx';
const ADMIN_ID = 1361715449;
const BOT_USERNAME = 'nanat_bot'; 
const REQUIRED_GROUPS = ['scorpiozzz'];
const moment = require('moment');
moment.locale('id');

const fs = require('fs-extra');
const axios = require('axios');
const path = require('path');
const mime = require('mime-types');
const JavaScriptObfuscator = require('javascript-obfuscator');

const ENCRYPT_DIR = path.resolve(__dirname, 'encrypt');
const USERS_FILE = path.resolve(__dirname, 'user.json');

const {
  bokep,
  OWNER_ID,
  BANNER_FILE_ID,
  OWNER_CONTACT_URL
} = require('./config');

const OWNER = String(OWNER_ID);
// storage files
const groupFile = 'groupList.json';
const premFile = 'premList.json';
const aksesFile = 'aksesList.json';
const blFile = 'blackList.json';
const configFile = 'config.json';

const OWNER_ID = 123456789; // ganti dengan Telegram numeric user id pemilik (owner)
const OWNER_USERNAME = '@GyzenVtx'; // ganti dengan username tanpa @ (dipakai untuk tombol profil)
const DEFAULT_PARSE_MODE = 'MarkdownV2'; // mis. 'MarkdownV2' atau 'HTML' atau null
const THUMBNAIL_LINK = 'https://files.catbox.moe/q3dh29.jpg'; 

// ensure files exist
for (const f of [groupFile, premFile, aksesFile, blFile, configFile]) {
  if (!fs.existsSync(f)) fs.writeFileSync(f, '[]');
}

// load
let groups = JSON.parse(fs.readFileSync(groupFile));
let prems = JSON.parse(fs.readFileSync(premFile));
let akses = JSON.parse(fs.readFileSync(aksesFile));
let bl = JSON.parse(fs.readFileSync(blFile));
let config = JSON.parse(fs.readFileSync(configFile));

// config defaults
if (!config || typeof config !== 'object' || Array.isArray(config)) {
  config = { autoShareDelaySec: 10 };
}
if (!config.autoShareDelaySec) config.autoShareDelaySec = 10;

// helper save
function save(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// bot username
let botUsername = '';
bot.getMe()
  .then(me => {
    botUsername = me.username || '';
    console.log('✅ Bot jalan sebagai @' + botUsername);
  })
  .catch(err => {
    console.error('Gagal ambil info bot:', err.message);
  });

// keep track of last auto-share time per user
const lastAutoShare = {};

// utility check owner
function isOwner(msg) {
  return String(msg.from && msg.from.id) === OWNER;
}

// utility: send safe message monospace
function safeSend(chatId, text, opts = {}) {
  return bot.sendMessage(chatId, "```" + text + "```", {
    parse_mode: "MarkdownV2",
    ...opts
  }).catch(err => {
    console.warn('sendMessage error to', chatId, err.message);
  });
}

// store group
bot.on('new_chat_members', (msg) => {
  try {
    const chat = msg.chat;
    if (chat && (chat.type === 'group' || chat.type === 'supergroup')) {
      if (!groups.includes(chat.id)) {
        groups.push(chat.id);
        save(groupFile, groups);
        console.log(`📌 Bot ditambahkan ke grup: ${chat.title} (${chat.id})`);
      }
    }
  } catch (e) { console.error(e); }
});
let userState = {};      
let referrals = {};
let premiumUsers = {};
let verifiedUsers = {};

const bot = new TelegramBot(config.bokep, {polling: true});

const isPremium = (userId) => {
  if (!premiumUsers[userId]) return false;
  return premiumUsers[userId] > Date.now();
};

const addPremium = (userId, days) => {
  const expiry = isPremium(userId) ? premiumUsers[userId] : Date.now();
  premiumUsers[userId] = expiry + days * 24 * 60 * 60 * 1000;
};

const getReferralLinks = (userId) => {
  const links = [];
  for (let i = 1; i <= 5; i++) {
    links.push(`https://t.me/${BOT_USERNAME}?start=${userId}_${i}`);
  }
  return links;
};

const registerReferral = (refData, newUserId) => {
  const [inviterId] = refData.split('_');
  if (!referrals[inviterId]) referrals[inviterId] = { invited: [], count: 0 };

  if (!referrals[inviterId].invited.includes(newUserId)) {
    referrals[inviterId].invited.push(newUserId);
    referrals[inviterId].count += 1;

    bot.sendMessage(inviterId,
      `🎉 Selamat! Anda telah mengundang 1 orang baru.\n` +
      `Jumlah undangan: ${referrals[inviterId].count}\n` +
      `🏆 ${referrals[inviterId].count >= 5 ? 'Kamu berhak mendapatkan Premium 30 hari gratis!' : 'Undang minimal 5 orang untuk dapat Premium'}`);
  }
};

fs.ensureDirSync(ENCRYPT_DIR);
if (!fs.existsSync(USERS_FILE)) fs.writeJsonSync(USERS_FILE, []);

// in-memory state for awaiting file or broadcast
const waitingFor = {}; // { chatId: { action: 'obfjs'|'obfhtml'|'broadcast' } }

// helper: load/save users
function addUserIfNotExists(id) {
  try {
    const users = fs.readJsonSync(USERS_FILE);
    if (!users.includes(id)) {
      users.push(id);
      fs.writeJsonSync(USERS_FILE, users, { spaces: 2 });
    }
  } catch (e) {
    console.error('Error reading/writing user.json', e);
  }
}

// helper: download file by file_id to path
async function downloadFile(fileId, destPath) {
  const file = await bot.getFile(fileId);
  const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
  const writer = fs.createWriteStream(destPath);
  const response = await axios({ url, method: 'GET', responseType: 'stream' });
  response.data.pipe(writer);
  return new Promise((res, rej) => {
    writer.on('finish', res);
    writer.on('error', rej);
  });
}

// obfuscate JS using javascript-obfuscator
function obfuscateJS(content) {
  const obf = JavaScriptObfuscator.obfuscate(content, {
    compact: true,
    controlFlowFlattening: true,
    deadCodeInjection: true,
    debugProtection: false,
    disableConsoleOutput: true,
    stringArray: true,
    stringArrayEncoding: ['rc4'],
    stringArrayThreshold: 0.75
  });
  return obf.getObfuscatedCode();
}

// obfuscate HTML by embedding content in base64 and producing loader
function obfuscateHTML(content) {
  const b64 = Buffer.from(content, 'utf8').toString('base64');
  const loader = `<!-- Obfuscated by Gyzen -->
<!doctype html>
<html><head><meta charset="utf-8"><title>Obfuscated</title></head><body>
<script>
(function(){
  try{
    var s = atob("${b64}");
    document.open();
    document.write(s);
    document.close();
  }catch(e){
    document.body.innerHTML = "<pre>Failed to load content: "+(e.message||e)+"</pre>";
  }
})();
</script>
</body></html>`;
  return loader;
}

// send result file with optional thumbnail
async function sendResultWithThumb(chatId, filePath, caption) {
  try {
    if (THUMBNAIL_LINK) {
      await bot.sendPhoto(chatId, THUMBNAIL_LINK, { caption: caption || '' , parse_mode: DEFAULT_PARSE_MODE || undefined });
    }
  } catch (e) {
    console.warn('Thumbnail send error:', e.message || e);
  }
  await bot.sendDocument(chatId, filePath, {
    caption: caption || '',
    parse_mode: DEFAULT_PARSE_MODE || undefined
  });
}

const db = {
  welcome: loadData('welcome.json', { groups: {} }),
  leave: loadData('leave.json', { groups: {} }),
  setw: loadData('setw.json', { groups: {} }),
  setl: loadData('setl.json', { groups: {} }),
  filters: loadData('filters.json', { groups: {} }),
  responses: loadData('responses.json', { groups: {} }),
  muted: loadData('muted.json', { groups: {} }),
  waitingFor: loadData('waiting.json', {}),

  save: function() {
    saveData('welcome.json', this.welcome);
    saveData('leave.json', this.leave);
    saveData('setw.json', this.setw);
    saveData('setl.json', this.setl);
    saveData('filters.json', this.filters);
    saveData('responses.json', this.responses);
    saveData('muted.json', this.muted);
    saveData('waiting.json', this.waitingFor);
  }
};

function loadData(filename, defaultValue) {
  try {
    const data = fs.readFileSync(filename);
    return JSON.parse(data);
  } catch (err) {
    return defaultValue;
  }
}

function saveData(filename, data) {
  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
}

async function isAdmin(chatId, userId) {
  try {
    const admins = await bot.getChatAdministrators(chatId);
    return admins.some(admin => admin.user.id === userId);
  } catch (err) {
    console.error('Error checking admin status:', err);
    return false;
  }
}

async function getUserPhoto(userId) {
  try {
    const photos = await bot.getUserProfilePhotos(userId);
    if (photos.total_count > 0) {
      const fileId = photos.photos[0][0].file_id;
      return fileId;
    }
    return null;
  } catch (err) {
    console.error('Error getting user photo:', err);
    return null;
  }
}

function sendPreMessage(chatId, text, options = {}) {
  const formattedText = `<pre>${text}</pre>`;
  return bot.sendMessage(chatId, formattedText, { 
    parse_mode: 'HTML',
    ...options 
  });
}

async function getCountryCode(chatId) {
  try {
    const chat = await bot.getChat(chatId);
    return chat.location ? chat.location.country_code : 'ID';
  } catch (err) {
    return 'ID';
  }
}

bot.onText(/\/start/, (pesan) => {
    const idChat = pesan.chat.id;
    const pesanMenu = `
/pin
/unmute
/mute
/delrespon
/respon
/delfilter
/filter
/unpromote
/promote
/add
/kick
/setleave
/setwelcome
/leave
/welcome
/payment
/broadcast3
/obfuscatedhtml
/obfuscatedjs
/broadcast2
/cekid
/ping
/del
/close
/open
/unmute
/mute
/demote
/promote
/share
/createwebV2
/addprem
/broadcast
/menu_cweb
/menu_hentai
bot belum sepenuhnya bisa bekerja masih dalam proses pengembangan di harapkan untuk sabar!`;
    
    bot.sendMessage(idChat, pesanMenu, {parse_mode: 'HTML'});
});

bot.onText(/\/hentai/, (pesan) => {
    const idChat = pesan.chat.id;
    const pesanMenu = `
/hentai
/hentai2
/hentai3
/hentai4`;
    
    bot.sendMessage(idChat, pesanMenu, {parse_mode: 'HTML'});
});

bot.onText(/\/hentai$/, async (pesan) => {
    const idChat = pesan.chat.id;
    try {
        const hasil = await axios.get('https://api.waifu.pics/nsfw/waifu');
        bot.sendPhoto(idChat, hasil.data.url);
    } catch (error) {
        bot.sendMessage(idChat, 'gagal kirim foto wak😹');
    }
});

bot.onText(/\/hentai2$/, async (pesan) => {
    const idChat = pesan.chat.id;
    try {
        const hasil = await axios.get('https://api.waifu.pics/nsfw/neko');
        bot.sendPhoto(idChat, hasil.data.url);
    } catch (error) {
        bot.sendMessage(idChat, 'gagal kirim foto wak😹');
    }
});

bot.onText(/\/hentai3$/, async (pesan) => {
    const idChat = pesan.chat.id;
    try {
        const hasil = await axios.get('https://api.waifu.pics/nsfw/trap');
        bot.sendPhoto(idChat, hasil.data.url);
    } catch (error) {
        bot.sendMessage(idChat, 'gagal kirim foto wak😹');
    }
});

bot.onText(/\/hentai4$/, async (pesan) => {
    const idChat = pesan.chat.id;
    try {
        const hasil = await axios.get('https://api.waifu.pics/nsfw/blowjob');
        bot.sendPhoto(idChat, hasil.data.url);
    } catch (error) {
        bot.sendMessage(idChat, 'gagal kirim foto wak😹');
    }
});

bot.onText(/\/menu_cweb/, (msg) => {
  const welcome = `👋 <b>Selamat Datang di <i>Web Creator Bot</i></b>\n\n` +
                  `📁 Kirim file <b>.html</b> kamu,\n` +
                  `📝 Lalu kirim nama projectnya.\n\n` +
                  `📦 Bot ini akan otomatis membuat website <b>gratis</b> di Vercel!\n\n` +
                  `🚀 Ayo mulai sekarang!`;

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '👑 Admin', url: ADMIN_LINK }]
      ]
    },
    parse_mode: 'HTML'
  };

  bot.sendMessage(msg.chat.id, welcome, keyboard);
});

bot.on('document', async (msg) => {
  const chatId = msg.chat.id;
  const file = msg.document;

  if (!file.file_name.endsWith('.html')) {
    return bot.sendMessage(chatId, '❌ Hanya file .html yang didukung.');
  }

  try {
    const link = await bot.getFileLink(file.file_id);
    const htmlFile = await axios.get(link, { responseType: 'arraybuffer' });
    const path = `./${chatId}.html`;
    fs.writeFileSync(path, htmlFile.data);
    userState[chatId] = path;

    bot.sendMessage(chatId, '✅ File diterima!\n\n💬 Sekarang kirim <b>nama website</b> kamu (tanpa spasi).', { parse_mode: 'HTML' });
  } catch (err) {
    bot.sendMessage(chatId, '❌ Gagal mengunduh file.');
  }
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const filePath = userState[chatId];

  if (filePath && msg.text && !msg.text.startsWith('/')) {
    const name = msg.text.toLowerCase().replace(/\s+/g, '-');
    const html = fs.readFileSync(filePath).toString('base64');

    const payload = {
      name,
      files: [
        {
          file: 'index.html',
          data: html,
          encoding: 'base64'
        }
      ],
      projectSettings: {
        framework: null,
        devCommand: null,
        installCommand: null,
        buildCommand: null,
        outputDirectory: '.',
        rootDirectory: null
      }
    };

    try {
      await axios.post('https://api.vercel.com/v13/deployments', payload, {
        headers: {
          Authorization: `Bearer ${VERCEL_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      const date = moment().format('DD MMMM YYYY, HH:mm');
      const reply = `✅ <b>Website berhasil dibuat!</b>\n\n` +
                    `📛 <b>Nama:</b> ${name}\n` +
                    `🔗 <b>Link:</b> https://${name}.vercel.app\n` +
                    `🗓️ <b>Dibuat:</b> ${date}`;

      bot.sendMessage(chatId, reply, { parse_mode: 'HTML' });
    } catch (err) {
      bot.sendMessage(chatId, `❌ Gagal upload ke Vercel:\n${JSON.stringify(err.response?.data || err.message)}`);
    } finally {
      fs.unlinkSync(filePath);
      delete userState[chatId];
    }
  }
});

bot.onText(/\/broadcast (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  if (chatId != ADMIN_ID) return;
  const text = match[1];

  Object.keys(referrals).forEach(uid => {
    bot.sendMessage(uid, `📢 Broadcast dari Admin:\n\n${text}`);
  });
  bot.sendMessage(chatId, `✅ Broadcast terkirim ke semua user.`);
});


bot.on('polling_error', (error) => {
    console.log('Kesalahan polling:', error);
});

bot.onText(/\/addprem (\d+) (\d+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = parseInt(match[1]);
  const days = parseInt(match[2]);

  if (chatId != ADMIN_ID) return;

  addPremium(userId, days);
  bot.sendMessage(userId, `🏆 Anda diberikan Premium selama ${days} hari oleh admin!`);
  bot.sendMessage(chatId, `✅ Premium berhasil diberikan ke user ${userId}`);
});

bot.onText(/\/createwebV2(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const name = msg.from.first_name || 'User';
  const username = msg.from.username || 'anonymous';
  const refData = match[1];

  // Register referral jika ada
  if (refData) registerReferral(refData, chatId);

  // Cek join semua grup wajib
  let notJoined = [];
  for (const group of REQUIRED_GROUPS) {
    try {
      const member = await bot.getChatMember(group, chatId);
      if (['left', 'kicked'].includes(member.status)) notJoined.push(group);
    } catch (err) {
      notJoined.push(group);
    }
  }

  if (notJoined.length > 0) {
    return bot.sendMessage(chatId,
      `⚠️ Kamu harus join ke grup berikut terlebih dahulu untuk menggunakan bot:\n` +
      `${notJoined.join('\n')}`);
  }

  // User sudah join semua grup
  const userRefCount = referrals[chatId]?.count || 0;

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🌐 Buat Website', callback_data: 'create_web' }],
        [{ text: '📤 Undang Teman', callback_data: 'invite_friend' }]
      ]
    },
    parse_mode: 'Markdown'
  };

  bot.sendMessage(chatId, welcomeMsg(name, username, userRefCount, isPremium(chatId), true), keyboard);
});

// ======= CALLBACK HANDLER =======
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data === 'create_web') {
    if (!isPremium(chatId) && (referrals[chatId]?.count || 0) < 5) {
      return bot.sendMessage(chatId,
        `⚠️ Kamu belum bisa membuat website.\n` +
        `- Premium aktif? ${isPremium(chatId) ? '✅' : '❌'}\n` +
        `- Jumlah undangan: ${referrals[chatId]?.count || 0} / 5`);
    }
    bot.sendMessage(chatId, '💬 Kirim file HTML kamu terlebih dahulu (.html).');
  }

  if (data === 'invite_friend') {
    const links = getReferralLinks(chatId).join('\n');
    const count = referrals[chatId]?.count || 0;
    bot.sendMessage(chatId,
      `📎 Bagikan salah satu link di bawah ini untuk mendapatkan Premium 30 hari:\n\n${links}\n\n` +
      `Jumlah undanganmu saat ini: ${count}`);
  }

  bot.answerCallbackQuery(query.id);
});

// ======= HANDLER UNTUK FILE HTML =======
bot.on('document', async (msg) => {
  const chatId = msg.chat.id;
  const file = msg.document;

  if (!file.file_name.endsWith('.html')) {
    return bot.sendMessage(chatId, '❌ Hanya file .html yang didukung.');
  }

  try {
    const link = await bot.getFileLink(file.file_id);
    const htmlFile = await axios.get(link, { responseType: 'arraybuffer' });
    const path = `./${chatId}.html`;
    fs.writeFileSync(path, htmlFile.data);
    userState[chatId] = path;

    bot.sendMessage(chatId, '✅ File diterima!\n\n💬 Sekarang kirim <b>nama website</b> kamu (tanpa spasi).', { parse_mode: 'HTML' });
  } catch (err) {
    bot.sendMessage(chatId, '❌ Gagal mengunduh file.');
  }
});

// ======= HANDLER UNTUK NAMA WEBSITE =======
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  if (!userState[chatId] || msg.text?.startsWith('/')) return;

  const filePath = userState[chatId];
  const projectName = msg.text.toLowerCase().replace(/\s+/g, '-');

  try {
    const htmlBase64 = fs.readFileSync(filePath, { encoding: 'base64' });

    const payload = {
      name: projectName,
      files: [
        { file: 'index.html', data: htmlBase64, encoding: 'base64' }
      ],
      projectSettings: {
        framework: null,
        devCommand: null,
        installCommand: null,
        buildCommand: null,
        outputDirectory: '.',
        rootDirectory: null
      }
    };

    await axios.post('https://api.vercel.com/v13/deployments', payload, {
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const date = moment().format('DD MMMM YYYY, HH:mm');
    const reply = `✅ <b>Website berhasil dibuat!</b>\n\n` +
                  `📛 <b>Nama:</b> ${projectName}\n` +
                  `🔗 <b>Link:</b> https://${projectName}.vercel.app\n` +
                  `🗓️ <b>Dibuat:</b> ${date}`;

    bot.sendMessage(chatId, reply, { parse_mode: 'HTML' });
  } catch (err) {
    const errorMsg = err.response?.data || err.message;
    bot.sendMessage(chatId, `❌ Gagal upload ke Vercel:\n${JSON.stringify(errorMsg)}`);
  } finally {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    delete userState[chatId];
  }
});

bot.onText(/\/jaseb/, (msg) => {
  const chatId = msg.chat.id;
  if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
    if (!groups.includes(chatId)) {
      groups.push(chatId);
      save(groupFile, groups);
    }
  }

  const userIsPrem = prems.includes(String(msg.from.id));
  const text = `
╭──────( MENU USER )──────╮
│ /share Mempromosikan Jualan
│ /ping Mengecek respon bot server.
│ /cekid Menampilkan ID user
╰───────────────────────╯

╭──────( TOOLS MENU )─────╮
│ /delprem Menghapus status premium user.
│ /addprem Memberikan status premium user.
│ /addakses Memberikan akses khusus ke user.
│ /delakses Menghapus akses khusus user.
│ /listakses Menampilkan daftar user dengan akses.
│ /addbl Memasukkan user ke daftar blacklist.
│ /delbl Menghapus user dari daftar blacklist.
│ /listbl Menampilkan daftar blacklist.
│ /promote Menjadikan user admin
│ /demote Menurunkan admin jadi member biasa.
│ /open Membuka grup agar semua bisa kirim pesan.
│ /mute Membisukan user.
│ /unmute Membuka mute user.
│ /del Menghapus pesan tertentu.
╰───────────────────────╯
`;

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: "𝐓𝐀𝐌𝐁𝐀𝐇𝐊𝐀𝐍 𝐆𝐑𝐎𝐔𝐏", url: `https://t.me/${botUsername}?startgroup=new` }],
        [{ text: "𝐃𝐄𝐕𝐄𝐋𝐎𝐏𝐄𝐑", url: OWNER_CONTACT_URL }, { text: "𝐈𝐍𝐅𝐎𝐑𝐌𝐀𝐓𝐈𝐎𝐍 𝐁𝐎𝐓", callback_data: "info_bot" }]
      ]
    }
  };

  if (BANNER_FILE_ID && BANNER_FILE_ID !== '') {
    bot.sendPhoto(chatId, BANNER_FILE_ID, { caption: "```" + text + "```", parse_mode: "MarkdownV2", reply_markup: keyboard.reply_markup }).catch(() => {
      safeSend(chatId, text, keyboard);
    });
  } else {
    safeSend(chatId, text, keyboard);
  }
});

// callback
bot.on('callback_query', (q) => {
  try {
    if (!q.message) return;
    const chatId = q.message.chat.id;
    if (q.data === 'info_bot') {
      bot.answerCallbackQuery(q.id).catch(() => {});
      safeSend(chatId, `⬡ BOT JASEB\n⬡ Developer: ${OWNER_CONTACT_URL}\n⬡ Total Grup: ${groups.length}\n⬡ Premium Aktif: ${prems.includes(String(q.from.id)) ? 'Yes ✅' : 'No ❌'}`);
    } else {
      bot.answerCallbackQuery(q.id).catch(() => {});
    }
  } catch (e) { console.error(e); }
});

// --- MANUAL SHARE ---
bot.onText(/\/share/, (msg) => {
  try {
    const chatId = msg.chat.id;
    if (!msg.reply_to_message) return safeSend(chatId, "❌ Balas pesan yang ingin dibagikan dengan perintah /share.");

    const fromId = String(msg.from.id);
    if (bl.includes(fromId)) return safeSend(chatId, "⛔ Kamu diblacklist, tidak bisa menggunakan fitur ini.");

    const text = msg.reply_to_message.text || msg.reply_to_message.caption || '📎 (Pesan non-teks)';
    groups.forEach(g => {
      if (g === chatId) return;
      bot.sendMessage(g, "```🔄 Shared from " + (msg.from.username ? '@'+msg.from.username : msg.from.first_name) + ":\n\n" + text + "```", { parse_mode: "MarkdownV2" }).catch(()=>{});
    });
    safeSend(chatId, "✅ Pesan berhasil di-share ke semua grup.");
  } catch (e) { console.error(e); }
});

// --- AUTO-SHARE PREMIUM ---
bot.on('message', (msg) => {
  try {
    if (!msg || !msg.from) return;
    const uid = String(msg.from.id);
    if (!prems.includes(uid)) return;
    if (msg.text && msg.text.startsWith('/')) return;
    if (bl.includes(uid)) return;

    const now = Date.now();
    const last = lastAutoShare[uid] || 0;
    const delayMs = (config.autoShareDelaySec || 10) * 1000;
    if (now - last < delayMs) return;
    lastAutoShare[uid] = now;

    const text = msg.text || msg.caption || '📎 (Pesan non-teks)';

    groups.forEach(g => {
      if (g === msg.chat.id) return;
      bot.sendMessage(g, "```⬡ Auto-Share dari " + (msg.from.username ? '@'+msg.from.username : msg.from.first_name) + ":\n\n" + text + "```", { parse_mode: "MarkdownV2" }).catch(()=>{});
    });
  } catch (e) { console.error(e); }
});

// Group moderation
bot.onText(/\/promote/, (msg) => {
  if (!msg.reply_to_message) return safeSend(msg.chat.id, "⚠️ Reply user untuk promote.");
  bot.promoteChatMember(msg.chat.id, msg.reply_to_message.from.id, {
    can_manage_chat: true,
    can_delete_messages: true,
    can_restrict_members: true,
    can_promote_members: false,
    can_change_info: true,
    can_invite_users: true
  }).then(() => safeSend(msg.chat.id, "✅ User dipromote.")).catch(err => safeSend(msg.chat.id, "❌ Error: " + err.message));
});

bot.onText(/\/demote/, (msg) => {
  if (!msg.reply_to_message) return safeSend(msg.chat.id, "⚠️ Reply user untuk demote.");
  bot.promoteChatMember(msg.chat.id, msg.reply_to_message.from.id, {
    can_manage_chat: false,
    can_delete_messages: false,
    can_restrict_members: false,
    can_promote_members: false,
    can_change_info: false,
    can_invite_users: false
  }).then(() => safeSend(msg.chat.id, "✅ User didemote.")).catch(err => safeSend(msg.chat.id, "❌ Error: " + err.message));
});

bot.onText(/\/mute/, (msg) => {
  if (!msg.reply_to_message) return safeSend(msg.chat.id, "⚠️ Reply user untuk mute.");
  bot.restrictChatMember(msg.chat.id, msg.reply_to_message.from.id, {
    permissions: { can_send_messages: false }
  }).then(() => safeSend(msg.chat.id, "✅ User dimute.")).catch(err => safeSend(msg.chat.id, "❌ Error: " + err.message));
});

bot.onText(/\/unmute/, (msg) => {
  if (!msg.reply_to_message) return safeSend(msg.chat.id, "⚠️ Reply user untuk unmute.");
  bot.restrictChatMember(msg.chat.id, msg.reply_to_message.from.id, {
    permissions: { can_send_messages: true }
  }).then(() => safeSend(msg.chat.id, "✅ User diunmute.")).catch(err => safeSend(msg.chat.id, "❌ Error: " + err.message));
});

bot.onText(/\/open/, (msg) => {
  bot.setChatPermissions(msg.chat.id, {
    can_send_messages: true,
    can_send_media_messages: true,
    can_send_polls: true,
    can_add_web_page_previews: true,
    can_invite_users: true
  }).then(() => safeSend(msg.chat.id, "✅ Grup dibuka.")).catch(err => safeSend(msg.chat.id, "❌ Error: " + err.message));
});

bot.onText(/\/close/, (msg) => {
  bot.setChatPermissions(msg.chat.id, {
    can_send_messages: false
  }).then(() => safeSend(msg.chat.id, "✅ Grup ditutup.")).catch(err => safeSend(msg.chat.id, "❌ Error: " + err.message));
});

bot.onText(/\/del/, (msg) => {
  if (!msg.reply_to_message) return safeSend(msg.chat.id, "⚠️ Reply pesan untuk hapus.");
  bot.deleteMessage(msg.chat.id, msg.reply_to_message.message_id).catch(err => safeSend(msg.chat.id, "❌ Error: " + err.message));
});

// Utility
bot.onText(/\/ping/, (msg) => {
  safeSend(msg.chat.id, "🏓 Pong! Bot aktif.");
});

bot.onText(/\/cekid/, (msg) => {
  safeSend(msg.chat.id, `🆔 ID kamu: ${msg.from.id}`);
});

// Broadcast (Owner only)
bot.onText(/\/broadcast2 (.+)/, (msg, match) => {
  if (!isOwner(msg)) return safeSend(msg.chat.id, "⛔ Owner Only");
  const text = match[1];
  groups.forEach(g => {
    bot.sendMessage(g, text).catch(()=>{});
  });
  safeSend(msg.chat.id, "✅ Broadcast terkirim.");
});

bot.onText(/\/obf/, async (msg) => {
  const chatId = msg.chat.id;
  addUserIfNotExists(chatId);
  const ownerButton = {
    reply_markup: {
      inline_keyboard: [[{ text: 'Owner Profile', url: `https://t.me/${OWNER_USERNAME}` }]]
    },
  };
  await bot.sendMessage(chatId, `Halo! Kirim perintah /obfuscatedjs atau /obfuscatedhtml untuk mengirim file yang akan di-encrypt.\n\nOwner: @${OWNER_USERNAME}`, ownerButton);
});

bot.onText(/\/obfuscatedjs/, (msg) => {
  const chatId = msg.chat.id;
  waitingFor[chatId] = { action: 'obfjs' };
  addUserIfNotExists(chatId);
  bot.sendMessage(chatId, 'Kirim file .js sebagai *Document* (tidak sebagai code text). Saya akan obfuscate dan menyimpannya di folder encrypt.', { parse_mode: DEFAULT_PARSE_MODE || undefined });
});

bot.onText(/\/obfuscatedhtml/, (msg) => {
  const chatId = msg.chat.id;
  waitingFor[chatId] = { action: 'obfhtml' };
  addUserIfNotExists(chatId);
  bot.sendMessage(chatId, 'Kirim file .html sebagai *Document*. Saya akan encrypt/obfuscate dan menyimpannya di folder encrypt.', { parse_mode: DEFAULT_PARSE_MODE || undefined });
});

bot.onText(/\/broadcast3(?:\s+(.+))?/, (msg, match) => {
  const chatId = msg.chat.id;
  if (msg.from.id !== OWNER_ID) {
    return bot.sendMessage(chatId, 'Perintah /broadcast hanya untuk owner.');
  }
  const provided = match && match[1];
  if (provided) {
    doBroadcast(provided, OWNER_ID);
    return bot.sendMessage(chatId, 'Broadcast dikirim.');
  } else {
    waitingFor[chatId] = { action: 'broadcast' };
    return bot.sendMessage(chatId, 'Silakan kirim pesan yang akan di-broadcast (text atau markup).');
  }
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  addUserIfNotExists(chatId);

  if (msg.text && msg.text.startsWith('/')) return;

  const state = waitingFor[chatId];
  if (!state) return;

  if (state.action === 'broadcast') {
    if (msg.from.id !== OWNER_ID) {
      delete waitingFor[chatId];
      return bot.sendMessage(chatId, 'Hanya owner yang dapat melakukan broadcast.');
    }
    const text = msg.text || '';
    delete waitingFor[chatId];
    await doBroadcast(text, chatId);
    return bot.sendMessage(chatId, 'Broadcast selesai dikirim ke semua pengguna.');
  }

  if (state.action === 'obfjs' || state.action === 'obfhtml') {
    if (!msg.document) {
      delete waitingFor[chatId];
      return bot.sendMessage(chatId, 'Bukan document. Aksi dibatalkan. Harap ulangi perintah dan kirim file sebagai Document.');
    }

    const doc = msg.document;
    const origFileName = doc.file_name || `file_${Date.now()}`;
    const ext = path.extname(origFileName).toLowerCase();
    const allowedJs = ['.js'];
    const allowedHtml = ['.html', '.htm'];

    if (state.action === 'obfjs' && !allowedJs.includes(ext)) {
      delete waitingFor[chatId];
      return bot.sendMessage(chatId, `File harus berekstensi .js untuk /obfuscatedjs. Anda mengirim: ${ext}`);
    }
    if (state.action === 'obfhtml' && !allowedHtml.includes(ext)) {
      delete waitingFor[chatId];
      return bot.sendMessage(chatId, `File harus berekstensi .html untuk /obfuscatedhtml. Anda mengirim: ${ext}`);
    }

    const tmpDir = path.resolve(__dirname, 'tmp');
    await fs.ensureDir(tmpDir);
    const tmpPath = path.join(tmpDir, `${Date.now()}_${origFileName}`);
    try {
      await downloadFile(doc.file_id, tmpPath);
      const content = await fs.readFile(tmpPath, 'utf8');

      let outName, outPath, outContent;
      if (state.action === 'obfjs') {
        outContent = obfuscateJS(content);
        outName = origFileName.replace(/\.js$/i, `.obf.js`);
      } else {
        outContent = obfuscateHTML(content);
        outName = origFileName.replace(/\.html?$/i, `.obf.html`);
      }
      outPath = path.join(ENCRYPT_DIR, `${Date.now()}_${outName}`);
      await fs.writeFile(outPath, outContent, 'utf8');

      const caption = `Berhasil obfuscate: ${outName}`;
      await sendResultWithThumb(chatId, outPath, caption);

      await fs.remove(tmpPath);
      delete waitingFor[chatId];
    } catch (err) {
      console.error('Processing error', err);
      delete waitingFor[chatId];
      return bot.sendMessage(chatId, `Terjadi error saat memproses file: ${err.message || err}`);
    }
  }
});

async function doBroadcast(messageText, initiatorId) {
  let users = [];
  try {
    users = fs.readJsonSync(USERS_FILE);
  } catch (e) {
    console.error('Failed to read users file for broadcast', e);
    return;
  }
  for (const uid of users) {
    try {
      await bot.sendMessage(uid, messageText, { parse_mode: DEFAULT_PARSE_MODE || undefined });
    } catch (e) {
      console.warn(`Failed send to ${uid}: ${e.message || e}`);
    }
  }
}

const ownerId = 123456789; 
const ownerUsername = "lanzsync"; 
const danaNumber = "085810683665";
const gopayNumber = "085810683665";
const qrisPath = path.join(__dirname, "qris.jpg");
let userPaymentMethod = {};

bot.onText(/\/payment/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendPhoto(chatId, "https://files.catbox.moe/wvj6v0.jpg", {
    caption: `\`\`\`
⬡ ᴡᴇʟᴄᴏᴍᴇ ᴘᴀʏᴍᴇɴᴛ ʟᴀɴᴢʏ
⬡ ᴜɴᴛᴜᴋ ᴍᴇɴᴇʀɪᴍᴀ ᴘᴇᴍʙᴀʏᴀʀᴀɴ 
⬡ ᴠɪᴀ ᴅᴀɴᴀ , ɢᴏᴘᴀʏ , Qʀɪꜱ
⬡ ꜱɪʟᴀʜᴋᴀɴ ᴘɪʟɪʜ ᴍᴇᴛᴏᴅᴇ ᴘᴇᴍʙᴀʏᴀʀᴀɴ
\`\`\``,
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "☇ ＤＡＮＡ", callback_data: "pay_dana" }],
        [{ text: "☇ ＧＯＰＡＹ", callback_data: "pay_gopay" }],
        [{ text: "☇ ＱＲＩＳ", callback_data: "pay_qris" }],
      ],
    },
  });
});

bot.on("callback_query", (callbackQuery) => {
  const data = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;
  const username = callbackQuery.from.username || "No username";
  const userId = callbackQuery.from.id;

  if (data === "pay_dana") {
    userPaymentMethod[userId] = "DANA";
    bot.sendMessage(chatId, `DANA : \`${danaNumber}\``, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "📋 Salin Nomor DANA", url: `tg://copy?text=${danaNumber}` }],
          [{ text: "✅ Selesai Transfer", callback_data: "done_payment" }],
          [{ text: "📩 Hubungi Owner", url: `https://t.me/${ownerUsername}` }],
        ],
      },
    });
  }

  if (data === "pay_gopay") {
    userPaymentMethod[userId] = "GOPAY";
    bot.sendMessage(chatId, `GOPAY : \`${gopayNumber}\``, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "📋 Salin Nomor GOPAY", url: `tg://copy?text=${gopayNumber}` }],
          [{ text: "✅ Selesai Transfer", callback_data: "done_payment" }],
          [{ text: "📩 Hubungi Owner", url: `https://t.me/${ownerUsername}` }],
        ],
      },
    });
  }

  if (data === "pay_qris") {
    userPaymentMethod[userId] = "QRIS";

    if (fs.existsSync(qrisPath)) {
      bot.sendPhoto(chatId, qrisPath, {
        caption: "💳 Silakan scan QRIS di atas untuk melakukan pembayaran.",
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Selesai Transfer", callback_data: "done_payment" }],
            [{ text: "📩 Hubungi Owner", url: `https://t.me/${ownerUsername}` }],
          ],
        },
      }).catch(err => {
        console.error("Gagal mengirim QRIS:", err);
        bot.sendMessage(chatId, "⚠️ Gagal mengirim gambar QRIS. Hubungi owner untuk mendapatkan QRIS.");
      });
    } else {
      bot.sendMessage(chatId, "⚠️ Gambar QRIS tidak ditemukan. Hubungi owner untuk mendapatkan QRIS.");
    }
  }

  if (data === "done_payment") {
    const method = userPaymentMethod[userId] || "Unknown";
    bot.sendMessage(chatId, "Silakan kirim bukti transfer (foto) di sini.");

    bot.once("photo", (photoMsg) => {
      const fileId = photoMsg.photo[photoMsg.photo.length - 1].file_id;
      bot.sendPhoto(ownerId, fileId, {
        caption: `💰 *Pembayaran Baru*\n\n👤 Username: @${username}\n🆔 ID: ${userId}\n💳 Metode: ${method}`,
        parse_mode: "Markdown",
      });
      bot.sendMessage(chatId, "✅ Bukti transfer sudah dikirim ke owner. Terima kasih!");
    });
  }
});

bot.onText(/\/security/, async (msg) => {
  const chatId = msg.chat.id;
  const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
  
  if (isGroup) {
    if (!db.welcome.groups[chatId]) db.welcome.groups[chatId] = { enabled: false };
    if (!db.leave.groups[chatId]) db.leave.groups[chatId] = { enabled: false };
    if (!db.setw.groups[chatId]) db.setw.groups[chatId] = { message: 'Halo @{username} selamat datang di grup {group}. ID Anda: {id}' };
    if (!db.setl.groups[chatId]) db.setl.groups[chatId] = { message: 'Selamat tinggal @{username}, semoga harimu menyenangkan. ID Anda: {id}' };
    if (!db.filters.groups[chatId]) db.filters.groups[chatId] = { words: [] };
    if (!db.responses.groups[chatId]) db.responses.groups[chatId] = {};
    if (!db.muted.groups[chatId]) db.muted.groups[chatId] = {};
    db.save();
    
    sendPreMessage(chatId, 'BOT GRUP @XemzzXiterz\n\nGunakan perintah:\n/welcome on/off\n/leave on/off\n/setwelcome (reply text)\n/setleave (reply text)\n/kick &lt;id&gt;\n/add &lt;id&gt;\n/promote &lt;id&gt;\n/unpromote &lt;id&gt;\n/filter &lt;text&gt;\n/delfilter &lt;text&gt;\n/respon &lt;text&gt; &lt;respon&gt;\n/delrespon &lt;text&gt;\n/mute &lt;waktu&gt;\n/unmute\n/pin');
  } else {
    sendPreMessage(chatId, 'JOIN MURBUG BANG https://t.me/mbfree00 (BOT HANYA BISA DI GUNAKAN DI DALAM GRUP)');
  }
});

bot.onText(/\/welcome (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const action = match[1].toLowerCase();
  
  const admin = await isAdmin(chatId, userId);
  if (!admin) {
    sendPreMessage(chatId, 'Hanya admin yang bisa mengatur ini!');
    return;
  }
  
  if (action === 'on' || action === 'off') {
    if (!db.welcome.groups[chatId]) db.welcome.groups[chatId] = { enabled: false };
    db.welcome.groups[chatId].enabled = action === 'on';
    db.save();
    sendPreMessage(chatId, `Welcome message ${action === 'on' ? 'diaktifkan' : 'dimatikan'}`);
  } else {
    sendPreMessage(chatId, 'Gunakan: /welcome on atau /welcome off');
  }
});

bot.onText(/\/leave (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const action = match[1].toLowerCase();
  
  const admin = await isAdmin(chatId, userId);
  if (!admin) {
    sendPreMessage(chatId, 'Hanya admin yang bisa mengatur ini!');
    return;
  }
  
  if (action === 'on' || action === 'off') {
    if (!db.leave.groups[chatId]) db.leave.groups[chatId] = { enabled: false };
    db.leave.groups[chatId].enabled = action === 'on';
    db.save();
    sendPreMessage(chatId, `Leave message ${action === 'on' ? 'diaktifkan' : 'dimatikan'}`);
  } else {
    sendPreMessage(chatId, 'Gunakan: /leave on atau /leave off');
  }
});

bot.onText(/\/setwelcome$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  const admin = await isAdmin(chatId, userId);
  if (!admin) {
    sendPreMessage(chatId, 'Hanya admin yang bisa mengatur ini!');
    return;
  }
  
  if (msg.reply_to_message && msg.reply_to_message.text) {
    const message = msg.reply_to_message.text;
    
    if (!db.setw.groups[chatId]) db.setw.groups[chatId] = { message: '' };
    db.setw.groups[chatId].message = message;
    db.save();
    sendPreMessage(chatId, 'Pesan welcome berhasil diupdate!\n\nVariabel yang tersedia:\n{username} - Nama pengguna\n{group} - Nama grup\n{id} - ID pengguna\n{region} - Kode negara');
  } else {
    sendPreMessage(chatId, 'Gunakan: /setwelcome (reply pesan teks)\n\nVariabel yang tersedia:\n{username} - Nama pengguna\n{group} - Nama grup\n{id} - ID pengguna\n{region} - Kode negara');
  }
});

bot.onText(/\/setleave$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  const admin = await isAdmin(chatId, userId);
  if (!admin) {
    sendPreMessage(chatId, 'Hanya admin yang bisa mengatur ini!');
    return;
  }
  
  if (msg.reply_to_message && msg.reply_to_message.text) {
    const message = msg.reply_to_message.text;
    
    if (!db.setl.groups[chatId]) db.setl.groups[chatId] = { message: '' };
    db.setl.groups[chatId].message = message;
    db.save();
    sendPreMessage(chatId, 'Pesan leave berhasil diupdate!\n\nVariabel yang tersedia:\n{username} - Nama pengguna\n{group} - Nama grup\n{id} - ID pengguna\n{region} - Kode negara');
  } else {
    sendPreMessage(chatId, 'Gunakan: /setleave (reply pesan teks)\n\nVariabel yang tersedia:\n{username} - Nama pengguna\n{group} - Nama grup\n{id} - ID pengguna\n{region} - Kode negara');
  }
});

bot.on('new_chat_members', async (msg) => {
  const chatId = msg.chat.id;
  
  if (!db.welcome.groups[chatId] || !db.welcome.groups[chatId].enabled) return;
  
  const user = msg.new_chat_members[0];
  const welcomeMessage = db.setw.groups[chatId]?.message || 'Halo @{username} selamat datang di grup {group}. ID Anda: {id}';
  const region = await getCountryCode(chatId);
  
  const formattedMessage = welcomeMessage
    .replace(/\{username\}/g, `@${user.username || user.first_name}`)
    .replace(/\{group\}/g, msg.chat.title)
    .replace(/\{id\}/g, user.id)
    .replace(/\{region\}/g, region);
  
  try {
    const photo = await getUserPhoto(user.id);
    const options = {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'USER', url: `tg://user?id=${user.id}` }]
        ]
      }
    };
    
    if (photo) {
      bot.sendPhoto(chatId, photo, {
        caption: `<pre>${formattedMessage}</pre>`,
        parse_mode: 'HTML',
        reply_markup: options.reply_markup
      });
    } else {
      sendPreMessage(chatId, formattedMessage, {
        reply_markup: options.reply_markup
      });
    }
  } catch (err) {
    console.error('Error sending welcome message:', err);
    sendPreMessage(chatId, formattedMessage);
  }
});

bot.on('left_chat_member', async (msg) => {
  const chatId = msg.chat.id;
  
  if (!db.leave.groups[chatId] || !db.leave.groups[chatId].enabled) return;
  
  const user = msg.left_chat_member;
  const leaveMessage = db.setl.groups[chatId]?.message || 'Selamat tinggal @{username}, semoga harimu menyenangkan. ID Anda: {id}';
  const region = await getCountryCode(chatId);
  
  const formattedMessage = leaveMessage
    .replace(/\{username\}/g, `@${user.username || user.first_name}`)
    .replace(/\{group\}/g, msg.chat.title)
    .replace(/\{id\}/g, user.id)
    .replace(/\{region\}/g, region);
  
  try {
    const photo = await getUserPhoto(user.id);
    const options = {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'USER', url: `tg://user?id=${user.id}` }]
        ]
      }
    };
    
    if (photo) {
      bot.sendPhoto(chatId, photo, {
        caption: `<pre>${formattedMessage}</pre>`,
        parse_mode: 'HTML',
        reply_markup: options.reply_markup
      });
    } else {
      sendPreMessage(chatId, formattedMessage, {
        reply_markup: options.reply_markup
      });
    }
  } catch (err) {
    console.error('Error sending leave message:', err);
    sendPreMessage(chatId, formattedMessage);
  }
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const userId = msg.from.id;
  
  if (!text || !db.filters.groups[chatId] || !db.responses.groups[chatId]) return;
  
  const isUserAdmin = await isAdmin(chatId, userId);
  
  if (db.filters.groups[chatId].words && db.filters.groups[chatId].words.length > 0 && !isUserAdmin) {
    const filteredWords = db.filters.groups[chatId].words;
    const hasFilteredWord = filteredWords.some(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      return regex.test(text);
    });
    
    if (hasFilteredWord) {
      try {
        await bot.deleteMessage(chatId, msg.message_id);
      } catch (err) {
        console.error('Error deleting message:', err);
      }
      return;
    }
  }
  
  if (db.responses.groups[chatId]) {
    const responses = db.responses.groups[chatId];
    
    for (const [trigger, response] of Object.entries(responses)) {
      const regex = new RegExp(`\\b${trigger}\\b`, 'i');
      if (regex.test(text)) {
        sendPreMessage(chatId, response);
        break;
      }
    }
  }
});

bot.onText(/\/kick(?:@\w+)?(?:\s+(\S+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const target = match[1];
  
  const admin = await isAdmin(chatId, userId);
  if (!admin) {
    sendPreMessage(chatId, 'Hanya admin yang bisa menggunakan perintah ini!');
    return;
  }
  
  if (msg.reply_to_message) {
    const targetUserId = msg.reply_to_message.from.id;
    try {
      await bot.kickChatMember(chatId, targetUserId);
      sendPreMessage(chatId, `Pengguna dengan ID ${targetUserId} telah dikick.`);
    } catch (err) {
      console.error('Error kicking user:', err);
      sendPreMessage(chatId, 'Gagal mengkick pengguna. Pastikan bot adalah admin dan memiliki izin untuk mengkick.');
    }
  } else if (target) {
    try {
      await bot.kickChatMember(chatId, parseInt(target));
      sendPreMessage(chatId, `Pengguna dengan ID ${target} telah dikick.`);
    } catch (err) {
      console.error('Error kicking user:', err);
      sendPreMessage(chatId, 'Gagal mengkick pengguna. Pastikan bot adalah admin dan memiliki izin untuk mengkick.');
    }
  } else {
    sendPreMessage(chatId, 'Gunakan: /kick &lt;id&gt; atau reply pesan dengan /kick');
  }
});

bot.onText(/\/add(?:@\w+)?(?:\s+(\S+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const target = match[1];
  
  const admin = await isAdmin(chatId, userId);
  if (!admin) {
    sendPreMessage(chatId, 'Hanya admin yang bisa menggunakan perintah ini!');
    return;
  }
  
  if (target) {
    try {
      await bot.unbanChatMember(chatId, parseInt(target));
      sendPreMessage(chatId, `Pengguna dengan ID ${target} telah diunban.`);
    } catch (err) {
      console.error('Error unbanning user:', err);
      sendPreMessage(chatId, 'Gagal mengunban pengguna. Pastikan bot adalah admin dan memiliki izin untuk mengunban.');
    }
  } else {
    sendPreMessage(chatId, 'Gunakan: /add &lt;id&gt;');
  }
});

bot.onText(/\/promote(?:@\w+)?(?:\s+(\S+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const target = match[1];
  
  const admin = await isAdmin(chatId, userId);
  if (!admin) {
    sendPreMessage(chatId, 'Hanya admin yang bisa menggunakan perintah ini!');
    return;
  }
  
  if (target) {
    try {
      await bot.promoteChatMember(chatId, parseInt(target), {
        can_change_info: true,
        can_post_messages: true,
        can_edit_messages: true,
        can_delete_messages: true,
        can_invite_users: true,
        can_restrict_members: true,
        can_pin_messages: true,
        can_promote_members: false
      });
      sendPreMessage(chatId, `Pengguna dengan ID ${target} telah dipromote menjadi admin.`);
    } catch (err) {
      console.error('Error promoting user:', err);
      sendPreMessage(chatId, 'Gagal mempromote pengguna. Pastikan bot adalah admin dan memiliki izin untuk mempromote.');
    }
  } else {
    sendPreMessage(chatId, 'Gunakan: /promote &lt;id&gt;');
  }
});

bot.onText(/\/unpromote(?:@\w+)?(?:\s+(\S+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const target = match[1];
  
  const admin = await isAdmin(chatId, userId);
  if (!admin) {
    sendPreMessage(chatId, 'Hanya admin yang bisa menggunakan perintah ini!');
    return;
  }
  
  if (target) {
    try {
      await bot.promoteChatMember(chatId, parseInt(target), {
        can_change_info: false,
        can_post_messages: false,
        can_edit_messages: false,
        can_delete_messages: false,
        can_invite_users: false,
        can_restrict_members: false,
        can_pin_messages: false,
        can_promote_members: false
      });
      sendPreMessage(chatId, `Pengguna dengan ID ${target} telah diunpromote.`);
    } catch (err) {
      console.error('Error unpromoting user:', err);
      sendPreMessage(chatId, 'Gagal mengunpromote pengguna. Pastikan bot adalah admin dan memiliki izin untuk mengunpromote.');
    }
  } else {
    sendPreMessage(chatId, 'Gunakan: /unpromote &lt;id&gt;');
  }
});

bot.onText(/\/filter(?:@\w+)?(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = match[1];
  
  const admin = await isAdmin(chatId, userId);
  if (!admin) {
    sendPreMessage(chatId, 'Hanya admin yang bisa menggunakan perintah ini!');
    return;
  }
  
  if (text) {
    if (!db.filters.groups[chatId]) db.filters.groups[chatId] = { words: [] };
    if (!db.filters.groups[chatId].words) db.filters.groups[chatId].words = [];
    
    if (!db.filters.groups[chatId].words.includes(text)) {
      db.filters.groups[chatId].words.push(text);
      db.save();
      sendPreMessage(chatId, `Kata "${text}" telah ditambahkan ke filter.`);
    } else {
      sendPreMessage(chatId, `Kata "${text}" sudah ada dalam filter.`);
    }
  } else {
    sendPreMessage(chatId, 'Gunakan: /filter &lt;text&gt;');
  }
});

bot.onText(/\/delfilter(?:@\w+)?(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = match[1];
  
  const admin = await isAdmin(chatId, userId);
  if (!admin) {
    sendPreMessage(chatId, 'Hanya admin yang bisa menggunakan perintah ini!');
    return;
  }
  
  if (text) {
    if (!db.filters.groups[chatId] || !db.filters.groups[chatId].words) {
      sendPreMessage(chatId, 'Tidak ada filter yang aktif di grup ini.');
      return;
    }
    
    const index = db.filters.groups[chatId].words.indexOf(text);
    if (index !== -1) {
      db.filters.groups[chatId].words.splice(index, 1);
      db.save();
      sendPreMessage(chatId, `Kata "${text}" telah dihapus dari filter.`);
    } else {
      sendPreMessage(chatId, `Kata "${text}" tidak ditemukan dalam filter.`);
    }
  } else {
    sendPreMessage(chatId, 'Gunakan: /delfilter &lt;text&gt;');
  }
});

bot.onText(/\/respon(?:@\w+)?(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = match[1];
  
  const admin = await isAdmin(chatId, userId);
  if (!admin) {
    sendPreMessage(chatId, 'Hanya admin yang bisa menggunakan perintah ini!');
    return;
  }
  
  if (text) {
    const parts = text.split(' ');
    if (parts.length >= 2) {
      const trigger = parts[0];
      const response = parts.slice(1).join(' ');
      
      if (!db.responses.groups[chatId]) db.responses.groups[chatId] = {};
      
      db.responses.groups[chatId][trigger] = response;
      db.save();
      sendPreMessage(chatId, `Respon untuk "${trigger}" telah diatur ke "${response}".`);
    } else {
      sendPreMessage(chatId, 'Gunakan: /respon &lt;trigger&gt; &lt;response&gt;');
    }
  } else {
    sendPreMessage(chatId, 'Gunakan: /respon &lt;trigger&gt; &lt;response&gt;');
  }
});

bot.onText(/\/delrespon(?:@\w+)?(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = match[1];
  
  const admin = await isAdmin(chatId, userId);
  if (!admin) {
    sendPreMessage(chatId, 'Hanya admin yang bisa menggunakan perintah ini!');
    return;
  }
  
  if (text) {
    if (!db.responses.groups[chatId]) {
      sendPreMessage(chatId, 'Tidak ada respon yang aktif di grup ini.');
      return;
    }
    
    if (db.responses.groups[chatId][text]) {
      delete db.responses.groups[chatId][text];
      db.save();
      sendPreMessage(chatId, `Respon untuk "${text}" telah dihapus.`);
    } else {
      sendPreMessage(chatId, `Tidak ada respon untuk "${text}".`);
    }
  } else {
    sendPreMessage(chatId, 'Gunakan: /delrespon &lt;text&gt;');
  }
});

bot.onText(/\/mute(?:@\w+)?(?:\s+(\S+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const time = match[1];
  
  const admin = await isAdmin(chatId, userId);
  if (!admin) {
    sendPreMessage(chatId, 'Hanya admin yang bisa menggunakan perintah ini!');
    return;
  }
  
  if (msg.reply_to_message && time) {
    const targetUserId = msg.reply_to_message.from.id;
    const timeUnit = time.slice(-1);
    const timeValue = parseInt(time.slice(0, -1));
    
    let muteTime = 0;
    switch (timeUnit) {
      case 's':
        muteTime = timeValue * 1000;
        break;
      case 'm':
        muteTime = timeValue * 60 * 1000;
        break;
      case 'h':
        muteTime = timeValue * 60 * 60 * 1000;
        break;
      case 'd':
        muteTime = timeValue * 24 * 60 * 60 * 1000;
        break;
      default:
        sendPreMessage(chatId, 'Format waktu tidak valid. Gunakan: s (detik), m (menit), h (jam), d (hari)');
        return;
    }
    
    try {
      const untilDate = Math.floor((Date.now() + muteTime) / 1000);
      await bot.restrictChatMember(chatId, targetUserId, {
        until_date: untilDate,
        can_send_messages: false,
        can_send_media_messages: false,
        can_send_other_messages: false,
        can_add_web_page_previews: false
      });
      
      if (!db.muted.groups[chatId]) db.muted.groups[chatId] = {};
      db.muted.groups[chatId][targetUserId] = Date.now() + muteTime;
      db.save();
      
      sendPreMessage(chatId, `Pengguna dengan ID ${targetUserId} telah dimute selama ${time}.`);
    } catch (err) {
      console.error('Error muting user:', err);
      sendPreMessage(chatId, 'Gagal memute pengguna. Pastikan bot adalah admin dan memiliki izin untuk membatasi anggota.');
    }
  } else {
    sendPreMessage(chatId, 'Gunakan: /mute &lt;waktu&gt; (reply pesan pengguna)\nContoh: /mute 1h');
  }
});

bot.onText(/\/unmute$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  const admin = await isAdmin(chatId, userId);
  if (!admin) {
    sendPreMessage(chatId, 'Hanya admin yang bisa menggunakan perintah ini!');
    return;
  }
  
  if (msg.reply_to_message) {
    const targetUserId = msg.reply_to_message.from.id;
    
    try {
      await bot.restrictChatMember(chatId, targetUserId, {
        can_send_messages: true,
        can_send_media_messages: true,
        can_send_other_messages: true,
        can_add_web_page_previews: true
      });
      
      if (db.muted.groups[chatId] && db.muted.groups[chatId][targetUserId]) {
        delete db.muted.groups[chatId][targetUserId];
        db.save();
      }
      
      sendPreMessage(chatId, `Pengguna dengan ID ${targetUserId} telah diunmute.`);
    } catch (err) {
      console.error('Error unmuting user:', err);
      sendPreMessage(chatId, 'Gagal mengunmute pengguna. Pastikan bot adalah admin dan memiliki izin untuk membatasi anggota.');
    }
  } else {
    sendPreMessage(chatId, 'Gunakan: /unmute (reply pesan pengguna)');
  }
});

bot.onText(/\/pin$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  const admin = await isAdmin(chatId, userId);
  if (!admin) {
    sendPreMessage(chatId, 'Hanya admin yang bisa menggunakan perintah ini!');
    return;
  }
  
  if (msg.reply_to_message) {
    try {
      await bot.pinChatMessage(chatId, msg.reply_to_message.message_id);
      sendPreMessage(chatId, 'Pesan berhasil dipin!');
    } catch (err) {
      console.error('Error pinning message:', err);
      sendPreMessage(chatId, 'Gagal mempin pesan. Pastikan bot adalah admin dan memiliki izin untuk mempin pesan.');
    }
  } else {
    sendPreMessage(chatId, 'Gunakan: /pin (reply pesan yang ingin dipin)');
  }
});


// graceful save on exit
function gracefulExit() {
  try {
    save(groupFile, groups);
    save(premFile, prems);
    save(aksesFile, akses);
    save(blFile, bl);
    save(configFile, config);
  } catch (e) {}
  process.exit();
}
process.on('SIGINT', gracefulExit);
process.on('SIGTERM', gracefulExit);

console.log('udah wak');