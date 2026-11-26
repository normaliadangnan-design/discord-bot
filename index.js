require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
  Client, GatewayIntentBits, Events, SlashCommandBuilder, EmbedBuilder,
  PermissionFlagsBits, MessageFlags, ActivityType, InteractionContextType,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, ComponentType, AttachmentBuilder
} = require('discord.js');

// Optional ang canvas. Kapag wala, text embed ang gagamitin imbes na larawan
let canvasLib = null;
try {
  canvasLib = require('@napi-rs/canvas');
} catch {
  console.warn('Walang @napi-rs/canvas. Mag-run ng: npm i @napi-rs/canvas (para sa welcome at rank card)');
}

const { DISCORD_TOKEN, WELCOME_CHANNEL_ID } = process.env;
if (!DISCORD_TOKEN) {
  console.error('Walang DISCORD_TOKEN sa environment variables');
  process.exit(1);
}

// GuildMessages (hindi privileged) ay para sa XP system. GuildMembers (privileged) ay para lang sa welcome
const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages];
if (WELCOME_CHANNEL_ID) intents.push(GatewayIntentBits.GuildMembers);
const client = new Client({ intents });

/* ========== Helpers ========== */
const COLOR = 0x8b5cf6;
const GREEN = 0x22c55e;
const RED = 0xef4444;
const YELLOW = 0xf59e0b;
const COLORS = [COLOR, 0xec4899, 0x3b82f6, GREEN];
const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const NUM = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
const SPEED = 300; // bilis ng animation sa milliseconds (mas mababa = mas mabilis)
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pick = list => list[Math.floor(Math.random() * list.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const shuffle = list => {
  const a = [...list];
  for (let n = a.length - 1; n > 0; n--) {
    const j = randInt(0, n);
    [a[n], a[j]] = [a[j], a[n]];
  }
  return a;
};
const embed = (title, text, color = COLOR) => {
  const e = new EmbedBuilder().setColor(color).setTitle(title);
  if (text) e.setDescription(text);
  return e;
};
const success = (title, text) => embed(title, text, GREEN);
const fail = text => embed('❌ Hindi Natuloy', text, RED);
const notice = (title, text) => embed(title, text, YELLOW);
const bar = percent => '█'.repeat(Math.round(percent / 10)) + '░'.repeat(10 - Math.round(percent / 10));
const secret = content => ({ content, flags: MessageFlags.Ephemeral });

// Animation: ine-edit ang isang message nang paisa-isang frame
// Ang "final" ay puwedeng embed, message object, o function na gumagawa ng alinman doon
async function animate(i, frames, final, delay = SPEED, ephemeral = false) {
  const first = { embeds: [frames[0]] };
  if (ephemeral) first.flags = MessageFlags.Ephemeral;
  await i.reply(first);
  for (const frame of frames.slice(1)) {
    await sleep(delay);
    await i.editReply({ embeds: [frame] });
  }
  await sleep(delay);
  const result = typeof final === 'function' ? await final() : final;
  await i.editReply(result instanceof EmbedBuilder ? { embeds: [result] } : { embeds: [], ...result });
}

// Standard na loading animation para sa ibang commands
const loadingFrames = label => [40, 90].map((p, n) =>
  embed(`${['⏳', '✨'][n]} ${label}${'.'.repeat(n + 2)}`, `\`${bar(p)}\` ${p}%`));
const deliver = (i, label, final, ephemeral = false) =>
  animate(i, loadingFrames(label), final, SPEED, ephemeral);

// Animated na private message (error o paalala)
const warn = (i, text) => deliver(i, 'Sinusuri', fail(text), true);

/* ========== Canvas cards (welcome at rank) ========== */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

async function drawCard({ avatarUrl, title, subtitle, footer, progress, progressText, accent = '#8b5cf6' }) {
  const { createCanvas, loadImage } = canvasLib;
  const W = 900;
  const H = 300;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#1e1b4b');
  bg.addColorStop(1, '#4c1d95');
  roundRect(ctx, 0, 0, W, H, 32);
  ctx.fillStyle = bg;
  ctx.fill();

  // Dekorasyon
  ctx.save();
  roundRect(ctx, 0, 0, W, H, 32);
  ctx.clip();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(W - 60, 40, 160, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W - 260, H + 40, 120, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Avatar
  const size = 190;
  const cx = 50 + size / 2;
  const cy = H / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  try {
    ctx.drawImage(await loadImage(avatarUrl), cx - size / 2, cy - size / 2, size, size);
  } catch {
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
  }
  ctx.restore();
  ctx.lineWidth = 8;
  ctx.strokeStyle = accent;
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2 + 2, 0, Math.PI * 2);
  ctx.stroke();

  // Teksto
  const x = 290;
  const maxW = W - x - 40;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 50px sans-serif';
  ctx.fillText(fitText(ctx, title, maxW), x, 110);
  ctx.fillStyle = '#c4b5fd';
  ctx.font = '30px sans-serif';
  ctx.fillText(fitText(ctx, subtitle, maxW), x, 160);

  if (progress !== undefined) {
    const y = 205;
    const h = 30;
    roundRect(ctx, x, y, maxW, h, 15);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fill();
    roundRect(ctx, x, y, Math.max(h, maxW * Math.min(1, progress)), h, 15);
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.fillStyle = '#e5e7eb';
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(progressText ?? '', x + maxW, y + h + 32);
    ctx.textAlign = 'left';
  }
  if (footer) {
    ctx.fillStyle = '#a5b4fc';
    ctx.font = '26px sans-serif';
    ctx.fillText(fitText(ctx, footer, maxW), x, 225);
  }
  return canvas.toBuffer('image/png');
}

const avatarOf = user => user.displayAvatarURL({ extension: 'png', size: 256 });

/* ========== XP / Level system ========== */
const DATA_DIR = path.join(__dirname, 'data');
const XP_FILE = path.join(DATA_DIR, 'xp.json');
const XP_COOLDOWN = 60_000;
const xpCooldown = new Map();

function loadXp() {
  try {
    return JSON.parse(fs.readFileSync(XP_FILE, 'utf8'));
  } catch {
    return {};
  }
}
const xpData = loadXp();

let saveTimer = null;
function saveXpSoon() {
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    try {
      await fs.promises.mkdir(DATA_DIR, { recursive: true });
      await fs.promises.writeFile(`${XP_FILE}.tmp`, JSON.stringify(xpData));
      await fs.promises.rename(`${XP_FILE}.tmp`, XP_FILE);
    } catch (err) {
      console.error('Hindi ma-save ang XP:', err.message);
    }
  }, 5000);
}
function saveXpNow() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(XP_FILE, JSON.stringify(xpData));
  } catch (err) {
    console.error('Hindi ma-save ang XP:', err.message);
  }
}
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { saveXpNow(); process.exit(0); });
}

const xpNeeded = level => 5 * level * level + 50 * level + 100; // XP para umakyat mula level na ito

function peekUser(guildId, userId) {
  return xpData[guildId]?.[userId] ?? { xp: 0, level: 0, total: 0 };
}

function addXp(guildId, userId, amount) {
  const guild = (xpData[guildId] ??= {});
  const user = (guild[userId] ??= { xp: 0, level: 0, total: 0 });
  user.xp += amount;
  user.total += amount;
  let leveled = false;
  while (user.xp >= xpNeeded(user.level)) {
    user.xp -= xpNeeded(user.level);
    user.level++;
    leveled = true;
  }
  saveXpSoon();
  return { leveled, user };
}

function rankOf(guildId, userId) {
  const sorted = Object.entries(xpData[guildId] ?? {}).sort((a, b) => b[1].total - a[1].total);
  const index = sorted.findIndex(([id]) => id === userId);
  return index === -1 ? null : index + 1;
}

// Rank card (larawan kung may canvas, text kung wala)
async function rankPayload(user, guildId) {
  const d = peekUser(guildId, user.id);
  const need = xpNeeded(d.level);
  const rank = rankOf(guildId, user.id);
  const title = `📈 Rank ni ${user.username}`;
  if (canvasLib) {
    try {
      const buffer = await drawCard({
        avatarUrl: avatarOf(user),
        title: user.username,
        subtitle: `Level ${d.level}  •  Rank ${rank ? `#${rank}` : 'wala pa'}`,
        progress: d.xp / need,
        progressText: `${d.xp} / ${need} XP  (kabuuan: ${d.total})`
      });
      return {
        embeds: [embed(title).setImage('attachment://rank.png')],
        files: [new AttachmentBuilder(buffer, { name: 'rank.png' })]
      };
    } catch (err) {
      console.error('Rank card error:', err.message);
    }
  }
  return {
    embeds: [embed(title,
      `**Level:** ${d.level}\n**Rank:** ${rank ? `#${rank}` : 'wala pa'}\n` +
      `\`${bar((d.xp / need) * 100)}\` ${d.xp} / ${need} XP`).setThumbnail(avatarOf(user))]
  };
}

async function announceLevelUp(m, data) {
  const perms = m.channel.permissionsFor(client.user);
  if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) return;
  const msg = await m.channel.send({
    content: `${m.author}`,
    embeds: [notice(`${SPINNER[0]} Level up.`, `\`${bar(30)}\``)],
    allowedMentions: { users: [m.author.id] }
  });
  await sleep(SPEED);
  await msg.edit({ embeds: [embed(`${SPINNER[3]} Level up..`, `\`${bar(65)}\``, 0xec4899)] });
  await sleep(SPEED);
  await msg.edit({ embeds: [embed(`${SPINNER[6]} Level up...`, `\`${bar(95)}\``, 0x3b82f6)] });
  await sleep(SPEED);
  const card = await rankPayload(m.author, m.guildId);
  const final = success('🎉 LEVEL UP!', `${m.author} ay umabot sa **Level ${data.level}**!`);
  if (card.files) final.setImage('attachment://rank.png');
  await msg.edit({ embeds: [final], files: card.files ?? [] });
  if (perms.has(PermissionFlagsBits.AddReactions)) {
    for (const e of ['🎉', '🔥', '⬆️']) {
      await msg.react(e).catch(() => {});
      await sleep(250);
    }
  }
}

/* ========== Commands ========== */
const commands = new Map();

function add(name, description, run, build, permission) {
  const data = new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .setContexts(InteractionContextType.Guild);
  if (build) build(data);
  if (permission) data.setDefaultMemberPermissions(permission);
  commands.set(name, { data, run, permission });
}

/* ----- General ----- */
add('help', 'Listahan ng commands', async i => {
  const list = [...commands.values()].map(c => `\`/${c.data.name}\` - ${c.data.description}`);
  await deliver(i, 'Binubuksan ang menu', embed('📖 Mga Command', list.join('\n')), true);
});

add('ping', 'Tingnan ang bilis ng bot', async i => {
  const ping = client.ws.ping < 0 ? 'sinusukat pa' : `${Math.round(client.ws.ping)}ms`;
  await animate(i,
    [embed('🏓 Ping.'), embed('🏓 Ping..'), embed('🏓 Ping...')],
    embed('🏓 Pong!', `Latency: **${ping}**`), SPEED);
});

add('uptime', 'Gaano na katagal online ang bot', async i => {
  const since = Math.floor((Date.now() - client.uptime) / 1000);
  await deliver(i, 'Kinukuha ang uptime', embed('⏱️ Uptime', `Online mula <t:${since}:R>`));
});

add('avatar', 'Ipakita ang avatar', async i => {
  const user = i.options.getUser('user') ?? i.user;
  await deliver(i, 'Kinukuha ang avatar',
    embed(`🖼️ Avatar ni ${user.username}`).setImage(user.displayAvatarURL({ size: 1024 })));
}, c => c.addUserOption(o => o.setName('user').setDescription('Kaninong avatar')));

add('userinfo', 'Info ng isang user', async i => {
  const user = i.options.getUser('user') ?? i.user;
  await deliver(i, 'Hinahanap ang user', async () => {
    const member = await i.guild.members.fetch(user.id).catch(() => null);
    const lines = [
      `**Username:** ${user.username}`,
      `**ID:** ${user.id}`,
      `**Account ginawa:** <t:${Math.floor(user.createdTimestamp / 1000)}:D>`
    ];
    if (member?.joinedTimestamp) lines.push(`**Sumali sa server:** <t:${Math.floor(member.joinedTimestamp / 1000)}:D>`);
    return embed('👤 User Info', lines.join('\n')).setThumbnail(user.displayAvatarURL());
  });
}, c => c.addUserOption(o => o.setName('user').setDescription('Sinong user')));

add('serverinfo', 'Info ng server', async i => {
  await deliver(i, 'Kinukuha ang server info', async () => {
    const g = await client.guilds.fetch({ guild: i.guildId, force: true });
    const e = embed(`🏠 ${g.name}`, [
      `**Members:** ${g.approximateMemberCount ?? g.memberCount}`,
      `**Ginawa:** <t:${Math.floor(g.createdTimestamp / 1000)}:D>`,
      `**Boosts:** ${g.premiumSubscriptionCount ?? 0}`
    ].join('\n'));
    if (g.iconURL()) e.setThumbnail(g.iconURL({ size: 256 }));
    return e;
  });
});

add('say', 'Magsalita ang bot', async i => {
  await deliver(i, 'Nagta-type', embed('💬 Mensahe', i.options.getString('message', true)));
}, c => c.addStringOption(o => o.setName('message').setDescription('Sasabihin').setRequired(true).setMaxLength(2000)),
PermissionFlagsBits.ManageMessages);

add('poll', 'Gumawa ng botohan (24 oras)', async i => {
  // Hindi puwedeng idagdag ang poll sa pag-edit, kaya bagong message ito pagkatapos ng animation
  await deliver(i, 'Ginagawa ang botohan', success('📊 Handa na ang botohan!', 'Nasa ibaba ang botohan.'));
  await i.followUp({
    poll: {
      question: { text: i.options.getString('tanong', true) },
      answers: ['a', 'b'].map(k => ({ text: i.options.getString(k, true) })),
      duration: 24,
      allowMultiselect: false
    }
  });
}, c => c
  .addStringOption(o => o.setName('tanong').setDescription('Tanong').setRequired(true).setMaxLength(300))
  .addStringOption(o => o.setName('a').setDescription('Unang sagot').setRequired(true).setMaxLength(55))
  .addStringOption(o => o.setName('b').setDescription('Pangalawang sagot').setRequired(true).setMaxLength(55)));

/* ----- Live dashboard (auto-refresh tuwing 10s, 2 minuto) ----- */
const DASH_EVERY = 10_000;
const DASH_DURATION = 120_000;
const liveDashboards = new Set(); // isa lang kada user

function dashboardPayload(endsAt, tick) {
  const members = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);
  const ping = client.ws.ping < 0 ? 0 : Math.round(client.ws.ping);
  const ram = process.memoryUsage().heapUsed / 1048576;
  const since = Math.floor((Date.now() - client.uptime) / 1000);
  const pingColor = ping < 150 ? '32' : ping < 300 ? '33' : '31';
  const health = Math.max(10, 100 - Math.round(ping / 5));
  const e = embed(`${SPINNER[tick % SPINNER.length]} Live Dashboard`, [
    '```ansi',
    `\u001b[1;${pingColor}m● ONLINE\u001b[0m  \u001b[1;37m${ping}ms\u001b[0m`,
    '```',
    `\`${bar(health)}\` latency health`,
    `🔄 Auto-refresh tuwing ${DASH_EVERY / 1000}s • tapos <t:${Math.floor(endsAt / 1000)}:R>`
  ].join('\n'), COLORS[tick % COLORS.length]).addFields(
    { name: '🌐 Servers', value: `${client.guilds.cache.size}`, inline: true },
    { name: '👥 Members', value: `${members}`, inline: true },
    { name: '🧠 RAM', value: `${ram.toFixed(1)} MB`, inline: true },
    { name: '⏱️ Online mula', value: `<t:${since}:R>`, inline: true }
  );
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('local:dash_stop').setLabel('Itigil').setStyle(ButtonStyle.Danger).setEmoji('⏹️'));
  return { embeds: [e], components: [row] };
}

add('dashboard', 'Live dashboard na kusang nag-a-update', async i => {
  if (liveDashboards.has(i.user.id)) return warn(i, 'May bukas ka nang live dashboard.');
  liveDashboards.add(i.user.id);
  try {
    let endsAt = 0;
    await deliver(i, 'Binubuksan ang dashboard', () => {
      endsAt = Date.now() + DASH_DURATION;
      return dashboardPayload(endsAt, 0);
    });
    const msg = await i.fetchReply();
    let stopped = false;
    const col = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: DASH_DURATION + 15_000 });
    col.on('collect', async b => {
      if (b.customId !== 'local:dash_stop') return;
      if (b.user.id !== i.user.id) return b.reply(secret('Hindi sa iyo ang dashboard na ito.')).catch(() => {});
      stopped = true;
      col.stop();
      await b.update({ embeds: [notice('⏹️ Itinigil', 'Gamitin ulit ang /dashboard.')], components: [] }).catch(() => {});
    });
    let tick = 0;
    while (!stopped && Date.now() + DASH_EVERY <= endsAt + 1000) {
      await sleep(DASH_EVERY);
      if (stopped) break;
      try {
        await i.editReply(dashboardPayload(endsAt, ++tick));
      } catch {
        stopped = true; // nabura ang message o pumutok ang token
      }
    }
    col.stop();
    if (!stopped) {
      await i.editReply({ embeds: [notice('⏹️ Tapos na ang live view', 'Gamitin ulit ang /dashboard.')], components: [] }).catch(() => {});
    }
  } finally {
    liveDashboards.delete(i.user.id);
  }
});

/* ----- XP at levels ----- */
add('rank', 'Ipakita ang rank card', async i => {
  const user = i.options.getUser('user') ?? i.user;
  await deliver(i, 'Kinukuha ang rank', () => rankPayload(user, i.guildId));
}, c => c.addUserOption(o => o.setName('user').setDescription('Kaninong rank')));

add('leaderboard', 'Top 10 sa XP', async i => {
  await deliver(i, 'Kinukuha ang rankings', () => {
    const top = Object.entries(xpData[i.guildId] ?? {}).sort((a, b) => b[1].total - a[1].total).slice(0, 10);
    if (!top.length) return notice('🏆 Leaderboard', 'Wala pang may XP. Mag-chat para magsimula!');
    const medals = ['🥇', '🥈', '🥉'];
    return embed('🏆 Leaderboard', top.map(([id, d], n) =>
      `${medals[n] ?? `**${n + 1}.**`} <@${id}> • Level **${d.level}** • ${d.total} XP`).join('\n'));
  });
});

/* ----- Trivia (buttons na nagiging 🟢/🔴) ----- */
const TRIVIA = [
  { q: 'Sino ang itinuturing na pambansang bayani ng Pilipinas?', a: ['José Rizal', 'Andrés Bonifacio', 'Emilio Aguinaldo', 'Apolinario Mabini'], c: 0 },
  { q: 'Ilan ang opisyal na bilang ng isla ng Pilipinas?', a: ['7,641', '7,107', '6,500', '8,200'], c: 0 },
  { q: 'Ano ang pinakamalaking planeta sa solar system?', a: ['Jupiter', 'Saturn', 'Earth', 'Neptune'], c: 0 },
  { q: 'Ilang kulay mayroon ang bahaghari?', a: ['7', '5', '6', '8'], c: 0 },
  { q: 'Ano ang pambansang hayop ng Pilipinas?', a: ['Kalabaw', 'Agila', 'Tamaraw', 'Aso'], c: 0 },
  { q: 'Ano ang pinakamataas na bundok sa Pilipinas?', a: ['Bundok Apo', 'Bundok Pulag', 'Bundok Mayon', 'Bundok Makiling'], c: 0 },
  { q: 'Anong programming language ang gamit ng discord.js?', a: ['JavaScript', 'Python', 'Java', 'C#'], c: 0 },
  { q: 'Ano ang kabisera ng Japan?', a: ['Tokyo', 'Osaka', 'Kyoto', 'Seoul'], c: 0 },
  { q: 'Ilang segundo ang nasa isang oras?', a: ['3,600', '360', '6,000', '1,800'], c: 0 },
  { q: 'Ano ang pinakamalaking karagatan sa mundo?', a: ['Pacific', 'Atlantic', 'Indian', 'Arctic'], c: 0 },
  { q: 'Sino ang unang pangulo ng Unang Republika ng Pilipinas?', a: ['Emilio Aguinaldo', 'Manuel Quezon', 'José P. Laurel', 'Sergio Osmeña'], c: 0 },
  { q: 'Anong elemento ang may simbolong "Au"?', a: ['Ginto', 'Pilak', 'Bakal', 'Tanso'], c: 0 }
];
const LETTERS = ['A', 'B', 'C', 'D'];

const triviaRow = (options, { chosen = -1, reveal = false, disabled = true } = {}) =>
  new ActionRowBuilder().addComponents(options.map((o, n) => {
    let style = ButtonStyle.Secondary;
    if (reveal && o.ok) style = ButtonStyle.Success;
    else if (reveal && n === chosen) style = ButtonStyle.Danger;
    else if (!reveal && n === chosen) style = ButtonStyle.Primary;
    const button = new ButtonBuilder()
      .setCustomId(`local:trivia:${n}`)
      .setLabel(`${LETTERS[n]}. ${o.text}`.slice(0, 80))
      .setStyle(style)
      .setDisabled(disabled);
    if (reveal && o.ok) button.setEmoji('🟢');
    else if (reveal && n === chosen) button.setEmoji('🔴');
    return button;
  }));

add('trivia', 'Trivia na may buttons', async i => {
  const q = pick(TRIVIA);
  const options = shuffle(q.a.map((text, n) => ({ text, ok: n === q.c })));
  const correct = options.find(o => o.ok).text;
  await animate(i,
    ['🧠 Pumipili ng tanong.', '🧠 Pumipili ng tanong..', '🧠 Pumipili ng tanong...']
      .map((t, n) => embed(t, `\`${bar([30, 60, 90][n])}\``, COLORS[n])),
    () => {
      const deadline = Math.floor(Date.now() / 1000) + 20;
      return {
        embeds: [embed('🧠 Trivia Time!', `**${q.q}**\n\n⏳ Matatapos <t:${deadline}:R>`)],
        components: [triviaRow(options, { disabled: false })]
      };
    }, SPEED);

  const msg = await i.fetchReply();
  const col = msg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 20_000,
    max: 1,
    filter: b => b.customId.startsWith('local:trivia:')
  });
  col.on('collect', async b => {
    const chosen = Number(b.customId.split(':')[2]);
    const ok = options[chosen].ok;
    try {
      await b.update({
        embeds: [notice('🔎 Sinusuri...', `**${q.q}**\n\n\`${bar(60)}\``)],
        components: [triviaRow(options, { chosen })]
      });
      await sleep(SPEED * 2);
      await b.editReply({
        embeds: [embed(ok ? '🟢 Tama!' : '🔴 Mali!',
          `**${q.q}**\n\n${b.user} ang sumagot: **${options[chosen].text}**` +
          (ok ? '' : `\nTamang sagot: **${correct}**`), ok ? GREEN : RED)],
        components: [triviaRow(options, { chosen, reveal: true })]
      });
    } catch (err) {
      console.error('Trivia error:', err.message);
    }
  });
  col.on('end', async collected => {
    if (collected.size) return;
    await i.editReply({
      embeds: [notice('⌛ Naubusan ng oras', `**${q.q}**\n\nTamang sagot: **${correct}**`)],
      components: [triviaRow(options, { reveal: true })]
    }).catch(() => {});
  });
});

/* ----- Tic-tac-toe (buttons na nagiging ❌ / ⭕) ----- */
const WINS = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

function boardRows(board, disabled = false, win = []) {
  return [0, 1, 2].map(r => new ActionRowBuilder().addComponents([0, 1, 2].map(c => {
    const idx = r * 3 + c;
    const v = board[idx];
    let style = ButtonStyle.Secondary;
    if (win.includes(idx)) style = ButtonStyle.Success;
    else if (v === 'X') style = ButtonStyle.Danger;
    else if (v === 'O') style = ButtonStyle.Primary;
    return new ButtonBuilder()
      .setCustomId(`local:ttt:${idx}`)
      .setEmoji(v === 'X' ? '❌' : v === 'O' ? '⭕' : '▫️')
      .setStyle(style)
      .setDisabled(disabled || v !== null);
  })));
}

add('tictactoe', 'Tic-tac-toe laban sa kaibigan', async i => {
  const foe = i.options.getUser('kalaban', true);
  if (foe.bot || foe.id === i.user.id) return warn(i, 'Pumili ng ibang tao (hindi bot at hindi ikaw).');

  const state = { phase: 'invite', board: Array(9).fill(null), turn: 0, players: [i.user, foe], over: false };
  const inviteRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('local:ttt_accept').setLabel('Tanggapin').setStyle(ButtonStyle.Success).setEmoji('⚔️'),
    new ButtonBuilder().setCustomId('local:ttt_decline').setLabel('Tanggihan').setStyle(ButtonStyle.Danger).setEmoji('🏳️'));
  const turnPayload = () => {
    const cur = state.players[state.turn];
    return {
      content: '',
      embeds: [embed('❌⭕ Tic-Tac-Toe',
        `❌ ${state.players[0]}  vs  ⭕ ${state.players[1]}\n\nTurn ni ${cur} ${state.turn === 0 ? '❌' : '⭕'}`)],
      components: boardRows(state.board)
    };
  };

  // Manu-manong animation para ma-ping ang kalaban sa unang message
  await i.reply({
    content: `${foe}`,
    embeds: [embed('⚔️ Naghahanda.', `\`${bar(30)}\``, YELLOW)],
    allowedMentions: { users: [foe.id] }
  });
  await sleep(SPEED);
  await i.editReply({ embeds: [embed('⚔️ Naghahanda..', `\`${bar(65)}\``, YELLOW)] });
  await sleep(SPEED);
  const deadline = Math.floor(Date.now() / 1000) + 60;
  await i.editReply({
    embeds: [notice('❌⭕ Tic-Tac-Toe',
      `${i.user} hinamon si ${foe}!\n\nMatatapos ang hamon <t:${deadline}:R>`)],
    components: [inviteRow]
  });

  const msg = await i.fetchReply();
  const col = msg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 15 * 60_000,
    idle: 60_000,
    filter: b => b.customId.startsWith('local:ttt')
  });

  col.on('collect', async b => {
    try {
      if (state.phase === 'invite') {
        if (b.customId === 'local:ttt_decline') {
          if (![i.user.id, foe.id].includes(b.user.id)) return await b.reply(secret('Hindi ikaw ang kasali rito.'));
          state.over = true;
          col.stop('done');
          return await b.update({ content: '', embeds: [embed('🏳️ Tinanggihan', `${b.user} ang tumanggi sa laro.`, RED)], components: [] });
        }
        if (b.customId === 'local:ttt_accept') {
          if (b.user.id !== foe.id) return await b.reply(secret('Para lang ito sa hinamon.'));
          state.phase = 'play';
          await b.update({ content: '', embeds: [embed('⚔️ Nagsisimula...', `\`${bar(60)}\``, YELLOW)], components: [] });
          await sleep(SPEED * 2);
          return await b.editReply(turnPayload());
        }
        return await b.deferUpdate();
      }

      // Habang naglalaro
      if (!b.customId.startsWith('local:ttt:')) return await b.deferUpdate();
      if (b.user.id !== state.players[state.turn].id) return await b.reply(secret('Hindi mo pa turn.'));
      const idx = Number(b.customId.split(':')[2]);
      if (state.board[idx]) return await b.deferUpdate();
      const mark = state.turn === 0 ? 'X' : 'O';
      state.board[idx] = mark;
      const line = WINS.find(l => l.every(k => state.board[k] === mark));
      if (line) {
        state.over = true;
        col.stop('done');
        return await b.update({
          content: '',
          embeds: [success('🏆 May panalo!', `${b.user} ang nanalo gamit ang ${mark === 'X' ? '❌' : '⭕'}! 🎉`)],
          components: boardRows(state.board, true, line)
        });
      }
      if (state.board.every(Boolean)) {
        state.over = true;
        col.stop('done');
        return await b.update({
          content: '',
          embeds: [notice('🤝 Tabla!', 'Wala ni isang nanalo.')],
          components: boardRows(state.board, true)
        });
      }
      state.turn ^= 1;
      await b.update(turnPayload());
    } catch (err) {
      console.error('Tic-tac-toe error:', err.message);
    }
  });

  col.on('end', async (_, reason) => {
    if (state.over || !['time', 'idle'].includes(reason)) return;
    await i.editReply({
      content: '',
      embeds: [notice('⌛ Naubusan ng oras', state.phase === 'invite' ? 'Walang sumagot sa hamon.' : 'Natigil ang laro dahil walang kumikilos.')],
      components: state.phase === 'play' ? boardRows(state.board, true) : []
    }).catch(() => {});
  });
}, c => c.addUserOption(o => o.setName('kalaban').setDescription('Sino ang hahamunin').setRequired(true)));

/* ----- Fun (animated) ----- */
add('coinflip', 'Mag-toss ng barya', async i => {
  await animate(i,
    ['🪙 Pinapaikot.', '🌕 Pinapaikot..', '🪙 Pinapaikot...'].map(t => embed(t)),
    embed('🪙 Resulta', `**${pick(['Heads (Tao)', 'Tails (Ibon)'])}!**`), SPEED);
});

add('dice', 'Magpagulong ng dice', async i => {
  const frames = ['🎲 Gumugulong.', '🎲 Gumugulong..', '🎲 Gumugulong...'].map(t => embed(t));
  await animate(i, frames, embed('🎲 Resulta', `Lumabas: **${randInt(1, 6)}**`), SPEED);
});

add('slots', 'Maglaro ng slot machine (katuwaan lang)', async i => {
  const icons = ['🍒', '🍋', '🍇', '⭐', '💎'];
  const result = [pick(icons), pick(icons), pick(icons)];
  const spin = () => pick(icons);
  const frames = [
    [spin(), spin(), spin()],
    [spin(), spin(), spin()],
    [result[0], spin(), spin()],
    [result[0], result[1], spin()]
  ].map(r => embed('🎰 Umiikot...', `# ${r.join(' | ')}`));
  const matches = new Set(result).size;
  const verdict = matches === 1 ? '🎉 JACKPOT!' : matches === 2 ? '✨ May pares!' : '😅 Talo, try ulit!';
  await animate(i, frames, embed(verdict, `# ${result.join(' | ')}`), SPEED);
});

add('8ball', 'Magtanong sa magic 8ball', async i => {
  const question = i.options.getString('tanong', true);
  const answer = pick(['Oo naman!', 'Hindi.', 'Siguro.', 'Malabo yan.', 'Sigurado ako, oo!', 'Tanong ka ulit mamaya.']);
  await animate(i,
    [embed('🎱 Nag-iisip.'), embed('🎱 Nag-iisip..'), embed('🎱 Nag-iisip...')],
    embed('🎱 Magic 8Ball', `**Tanong:** ${question}\n**Sagot:** ${answer}`), SPEED);
}, c => c.addStringOption(o => o.setName('tanong').setDescription('Tanong mo').setRequired(true).setMaxLength(300)));

add('rps', 'Bato bato pick laban sa bot', async i => {
  const names = { bato: '🪨 Bato', papel: '📄 Papel', gunting: '✂️ Gunting' };
  const beats = { bato: 'gunting', papel: 'bato', gunting: 'papel' };
  const you = i.options.getString('pili', true);
  const bot = pick(Object.keys(names));
  const result = you === bot ? '🤝 Tabla!' : beats[you] === bot ? '🎉 Panalo ka!' : '🤖 Panalo ako!';
  await animate(i,
    [embed('🪨 Bato...'), embed('📄 Bato... Bato...'), embed('✂️ Bato... Bato... PICK!')],
    embed(result, `Ikaw: ${names[you]}\nBot: ${names[bot]}`), SPEED);
}, c => c.addStringOption(o => o.setName('pili').setDescription('Pili mo').setRequired(true)
  .addChoices({ name: 'Bato', value: 'bato' }, { name: 'Papel', value: 'papel' }, { name: 'Gunting', value: 'gunting' })));

add('love', 'Love meter ng dalawang user (katuwaan lang)', async i => {
  const a = i.options.getUser('user1', true);
  const b = i.options.getUser('user2') ?? i.user;
  const score = randInt(0, 100);
  const frames = [10, 40, 70].map(p => embed('💘 Kinakalkula...', `\`${bar(p)}\``));
  await animate(i, frames, embed('💘 Love Meter', `${a} ❤️ ${b}\n\`${bar(score)}\` **${score}%**`), SPEED);
}, c => c
  .addUserOption(o => o.setName('user1').setDescription('Unang user').setRequired(true))
  .addUserOption(o => o.setName('user2').setDescription('Pangalawang user (default: ikaw)')));

add('choose', 'Pipili ang bot para sa iyo', async i => {
  const options = i.options.getString('choices', true).split(',').map(s => s.trim()).filter(Boolean);
  if (options.length < 2) return warn(i, 'Maglagay ng 2 o higit pa, paghiwalayin ng kuwit.');
  await animate(i,
    [embed('🤔 Namimili.'), embed('🤔 Namimili..'), embed('🤔 Namimili...')],
    embed('✅ Ang pinili ko', pick(options)), SPEED);
}, c => c.addStringOption(o => o.setName('choices').setDescription('Hal. adobo, sinigang').setRequired(true).setMaxLength(1000)));

// Countdown na may reactions: 5️⃣ 4️⃣ 3️⃣ 2️⃣ 1️⃣ 🚀
add('countdown', 'Animated na countdown na may reactions', async i => {
  const n = i.options.getInteger('segundo') ?? 5;
  await i.reply({ embeds: [embed('⏳ Countdown', `# ${n}`)] });
  const msg = await i.fetchReply();
  const canReact = i.appPermissions.has([PermissionFlagsBits.AddReactions, PermissionFlagsBits.ReadMessageHistory]);
  const react = async e => { if (canReact) await msg.react(e).catch(() => {}); };
  await react(NUM[n]);
  for (let x = n - 1; x >= 1; x--) {
    await sleep(1000);
    await i.editReply({ embeds: [embed('⏳ Countdown', `# ${x}`, COLORS[x % COLORS.length])] });
    await react(NUM[x]);
  }
  await sleep(1000);
  await i.editReply({ embeds: [success('🚀 GO!', '# 🔥🔥🔥')] });
  await react('🚀');
}, c => c.addIntegerOption(o => o.setName('segundo').setDescription('3 hanggang 10').setMinValue(3).setMaxValue(10)));

add('loading', 'Animated na loading bar', async i => {
  const frames = [0, 30, 70].map(p => embed('⚙️ Loading...', `\`${bar(p)}\` ${p}%`));
  await animate(i, frames, embed('✅ Tapos na!', `\`${bar(100)}\` 100%`), SPEED);
});

/* ----- Moderation ----- */
add('clear', 'Magbura ng messages', async i => {
  if (!i.appPermissions.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ReadMessageHistory])) {
    return warn(i, 'Kailangan ko ng View Channel, Manage Messages at Read Message History.');
  }
  await deliver(i, 'Naglilinis', async () => {
    const deleted = await i.channel.bulkDelete(i.options.getInteger('dami', true), true);
    return success('🧹 Tapos na!', `Nabura: **${deleted.size}** (hindi mabubura nang sabay ang lampas 14 na araw)`);
  }, true);
}, c => c.addIntegerOption(o => o.setName('dami').setDescription('1 hanggang 100').setRequired(true).setMinValue(1).setMaxValue(100)),
PermissionFlagsBits.ManageMessages);

// Safety check: bawal sa sarili, sa bot, at sa mas mataas o kapantay na role
// getMember: kasama na sa command ang member, kaya walang hintay bago makasagot
function getTarget(i) {
  const user = i.options.getUser('user', true);
  const member = i.options.getMember('user');
  let problem = null;
  if (!member) problem = 'Wala sa server ang user.';
  else if (user.id === i.user.id || user.id === client.user.id) problem = 'Hindi puwede sa sarili mo o sa bot.';
  else if (i.guild.ownerId !== i.user.id && member.roles.highest.comparePositionTo(i.member.roles.highest) >= 0) {
    problem = 'Mas mataas o kapantay mo ang role niya.';
  }
  return { user, member, problem };
}

function addModeration(name, description, permission, check, style, action, extra) {
  add(name, description, async i => {
    const { user, member, problem } = getTarget(i);
    if (problem) return warn(i, problem);
    if (!i.appPermissions.has(permission) || !member[check]) {
      return warn(i, 'Kulang ang permission ng bot, o mas mataas ang role ng user.');
    }
    const reason = i.options.getString('dahilan') ?? 'Walang dahilan';
    const avatar = user.displayAvatarURL({ size: 256 });
    const frames = style.frames.map((title, n) =>
      embed(title, `**${user.username}**\n\`${bar([30, 65, 95][n])}\``, style.color).setThumbnail(avatar));
    await animate(i, frames, async () => {
      const done = await action(i, member, `${i.user.username}: ${reason}`.slice(0, 512));
      return embed(`${style.icon} ${done}`,
        `**User:** ${user.username}\n**Moderator:** ${i.user.username}\n**Dahilan:** ${reason}`, style.color)
        .setThumbnail(avatar).setTimestamp();
    });
  }, c => {
    c.addUserOption(o => o.setName('user').setDescription('Target').setRequired(true));
    if (extra) extra(c);
    c.addStringOption(o => o.setName('dahilan').setDescription('Dahilan').setMaxLength(400));
  }, permission);
}

addModeration('timeout', 'I-timeout ang user', PermissionFlagsBits.ModerateMembers, 'moderatable',
  { icon: '🔇', color: YELLOW, frames: ['⏳ Inihahanda.', '⌛ Pinapatahimik..', '🔇 Tina-timeout...'] },
  async (i, member, reason) => {
    const minutes = i.options.getInteger('minuto', true);
    await member.timeout(minutes * 60_000, reason);
    return `Na-timeout nang ${minutes} minuto`;
  },
  c => c.addIntegerOption(o => o.setName('minuto').setDescription('Ilang minuto').setRequired(true).setMinValue(1).setMaxValue(40320)));

addModeration('untimeout', 'Alisin ang timeout', PermissionFlagsBits.ModerateMembers, 'moderatable',
  { icon: '🔊', color: GREEN, frames: ['⏳ Inihahanda.', '⌛ Inaayos..', '🔊 Inaalis ang timeout...'] },
  async (i, member, reason) => { await member.timeout(null, reason); return 'Inalis ang timeout'; });

addModeration('kick', 'I-kick ang user', PermissionFlagsBits.KickMembers, 'kickable',
  { icon: '👢', color: YELLOW, frames: ['🎯 Tina-target.', '🦵 Bumubuwelo..', '👢 Kini-kick...'] },
  async (i, member, reason) => { await member.kick(reason); return 'Na-kick'; });

addModeration('ban', 'I-ban ang user', PermissionFlagsBits.BanMembers, 'bannable',
  { icon: '🔨', color: RED, frames: ['🎯 Tina-target.', '⚡ Inaangat ang ban hammer..', '🔨 Bina-ban...'] },
  async (i, member, reason) => { await member.ban({ reason }); return 'Na-ban'; });

/* ----- Dagdag na commands ----- */
add('joke', 'Random na joke', async i => {
  await deliver(i, 'Nag-iisip ng joke', embed('😂 Joke', pick([
    'Bakit malungkot ang kalendaryo? Bilang na kasi ang mga araw niya.',
    'Anong isda ang mahilig matulog? E di tulog-ingan!',
    'Bakit nag-aral ang programmer sa dagat? Gusto niyang matuto ng C.',
    'Anong sabi ng zero sa eight? Uy, ganda ng belt mo!'
  ])));
});

add('membercount', 'Bilang ng members', async i => {
  await deliver(i, 'Binibilang', async () => {
    const g = await client.guilds.fetch({ guild: i.guildId, force: true });
    return embed('👥 Members', `**${g.approximateMemberCount ?? g.memberCount}** members`);
  });
});

add('announce', 'Magpadala ng announcement dito', async i => {
  const needed = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
  if (!i.appPermissions.has(needed)) return warn(i, 'Kailangan ko ng View Channel, Send Messages at Embed Links.');
  await deliver(i, 'Ipinapadala', async () => {
    await i.channel.send({ embeds: [embed('📢 Announcement', i.options.getString('message', true))] });
    return success('✅ Naipadala na!', 'Nasa channel na ang announcement.');
  }, true);
}, c => c.addStringOption(o => o.setName('message').setDescription('Announcement').setRequired(true).setMaxLength(2000)),
PermissionFlagsBits.ManageMessages);

add('slowmode', 'Itakda ang slowmode ng channel', async i => {
  if (!i.appPermissions.has(PermissionFlagsBits.ManageChannels)) return warn(i, 'Kailangan ko ng Manage Channels.');
  const seconds = i.options.getInteger('segundo', true);
  await deliver(i, 'Inaayos', async () => {
    await i.channel.setRateLimitPerUser(seconds);
    return success('🐢 Slowmode', seconds ? `Naka-set sa **${seconds}s**` : 'Naka-off na');
  });
}, c => c.addIntegerOption(o => o.setName('segundo').setDescription('0 para i-off').setRequired(true).setMinValue(0).setMaxValue(21600)),
PermissionFlagsBits.ManageChannels);

function addLock(name, description, value, message) {
  add(name, description, async i => {
    if (!i.appPermissions.has([PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles])) {
      return warn(i, 'Kailangan ko ng Manage Channels at Manage Roles.');
    }
    if (i.channel.type !== ChannelType.GuildText) return warn(i, 'Sa text channel lang ito puwede.');
    await deliver(i, 'Inaayos', async () => {
      // Kapag nag-lock, payagan muna ang bot para makapag-send pa rin ito
      if (value === false) await i.channel.permissionOverwrites.edit(client.user, { SendMessages: true });
      await i.channel.permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: value });
      return success(message, `Binago ni ${i.user.username}`);
    });
  }, null, PermissionFlagsBits.ManageChannels);
}
addLock('lock', 'I-lock ang channel', false, '🔒 Naka-lock na ang channel');
addLock('unlock', 'I-unlock ang channel', null, '🔓 Naka-unlock na ang channel');

/* ========== Verify at Ticket ========== */
const button = (id, label, style, emoji) => new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style).setEmoji(emoji));

// Mga permission na hindi puwedeng ipamigay ng verify button
const DANGEROUS = [
  'Administrator', 'ManageGuild', 'ManageRoles', 'ManageChannels', 'ManageMessages',
  'ManageWebhooks', 'ManageNicknames', 'ManageThreads', 'ManageEvents',
  'ManageGuildExpressions', 'KickMembers', 'BanMembers', 'ModerateMembers', 'MentionEveryone'
].map(name => PermissionFlagsBits[name]);

const safeRole = (guild, role) => Boolean(role) && role.id !== guild.id && !role.managed && role.editable &&
  !DANGEROUS.some(flag => role.permissions.has(flag, false));

// Animated na panel na may button
async function sendPanel(channel, title, text, row) {
  const message = await channel.send({ embeds: [embed('⏳ Inihahanda.', `\`${bar(30)}\``)] });
  await sleep(SPEED);
  await message.edit({ embeds: [embed('✨ Inihahanda..', `\`${bar(80)}\``)] });
  await sleep(SPEED);
  await message.edit({ embeds: [embed(title, text)], components: [row] });
}

const panelPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];

add('setup-verify', 'Maglagay ng verify button sa channel na ito', async i => {
  const role = i.options.getRole('role', true);
  if (!i.appPermissions.has([...panelPermissions, PermissionFlagsBits.ManageRoles])) {
    return warn(i, 'Kailangan ko ng View Channel, Send Messages, Embed Links at Manage Roles.');
  }
  if (!safeRole(i.guild, role)) {
    return warn(i, 'Hindi puwede ang role na ito. Dapat mas mababa sa role ng bot at walang admin o moderation permission.');
  }
  if (i.guild.ownerId !== i.user.id && role.comparePositionTo(i.member.roles.highest) >= 0) {
    return warn(i, 'Dapat mas mababa ang role kaysa sa pinakamataas mong role.');
  }
  await deliver(i, 'Sine-setup', async () => {
    await sendPanel(i.channel, '✅ Verification', `Pindutin ang button para makuha ang <@&${role.id}> role.`,
      button(`verify:${role.id}`, 'Verify', ButtonStyle.Success, '✅'));
    return success('✅ Tapos na!', 'Naka-setup na ang verification.');
  }, true);
}, c => c.addRoleOption(o => o.setName('role').setDescription('Role na ibibigay').setRequired(true)),
PermissionFlagsBits.Administrator);

add('setup-ticket', 'Maglagay ng ticket button sa channel na ito', async i => {
  const staff = i.options.getRole('staff', true);
  const category = i.options.getChannel('category');
  if (!i.appPermissions.has([...panelPermissions, PermissionFlagsBits.ManageChannels])) {
    return warn(i, 'Kailangan ko ng View Channel, Send Messages, Embed Links at Manage Channels.');
  }
  if (staff.id === i.guild.id) return warn(i, 'Hindi puwedeng @everyone ang staff role.');
  await deliver(i, 'Sine-setup', async () => {
    await sendPanel(i.channel, '🎫 Support Ticket', 'Kailangan ng tulong? Pindutin ang button para magbukas ng ticket.',
      button(`ticket_open:${staff.id}:${category?.id ?? i.channel.parentId ?? '0'}`, 'Open Ticket', ButtonStyle.Primary, '🎫'));
    return success('✅ Tapos na!', 'Naka-setup na ang ticket system.');
  }, true);
}, c => c
  .addRoleOption(o => o.setName('staff').setDescription('Role na sasagot sa tickets').setRequired(true))
  .addChannelOption(o => o.setName('category').setDescription('Category ng mga ticket').addChannelTypes(ChannelType.GuildCategory)),
PermissionFlagsBits.Administrator);

const openingTicket = new Set(); // iwas dobleng ticket kapag sunod-sunod ang pindot
const closingTicket = new Set();

async function handleVerify(i, roleId) {
  const frames = ['🔍 Sinusuri ang account.', '🛡️ Vine-verify..', '🔑 Ibinibigay ang role...']
    .map((title, n) => embed(title, `\`${bar([30, 65, 95][n])}\``));
  await animate(i, frames, async () => {
    const role = await i.guild.roles.fetch(roleId);
    if (!safeRole(i.guild, role)) return fail('Hindi maibigay ang role. Sabihan ang admin.');
    if (i.member.roles.cache.has(role.id)) return notice('ℹ️ Verified ka na!', 'Nasa iyo na ang role.');
    await i.member.roles.add(role, 'Verify button');
    return success('🎉 Verified!', `Nakuha mo na ang <@&${role.id}> role.`);
  }, SPEED, true);
}

async function createTicket(i, staffId, categoryId) {
  const channels = await i.guild.channels.fetch();
  const existing = channels.find(c => c?.topic?.startsWith(`ticket:${i.user.id}:`));
  if (existing) return notice('ℹ️ May bukas ka pang ticket', `Pumunta sa <#${existing.id}>`);

  const staff = await i.guild.roles.fetch(staffId);
  if (!staff) return fail('Wala na ang staff role. Ipa-setup ulit sa admin.');

  // Dapat nasa bot ang lahat ng permission na ibibigay nito sa ticket channel
  const needed = ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'EmbedLinks', 'ManageChannels'];
  if (!i.guild.members.me.permissions.has(needed.map(name => PermissionFlagsBits[name]))) {
    return fail('Kulang ang permission ng bot. Kailangan: View Channels, Send Messages, Read Message History, Embed Links at Manage Channels.');
  }

  const member = [
    PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory
  ];
  const channel = await i.guild.channels.create({
    name: `ticket-${i.user.username}`.slice(0, 90),
    type: ChannelType.GuildText,
    parent: channels.has(categoryId) ? categoryId : null,
    topic: `ticket:${i.user.id}:${staffId}`,
    permissionOverwrites: [
      { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: i.user.id, allow: member },
      { id: staffId, allow: member },
      { id: client.user.id, allow: [...member, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageChannels] }
    ]
  });
  try {
    // Nasa content ang mention dahil hindi nagpi-ping ang mention sa loob ng embed
    const message = await channel.send({
      content: `<@${i.user.id}> <@&${staffId}>`,
      embeds: [embed('⏳ Binubuksan ang ticket.', `\`${bar(30)}\``)],
      allowedMentions: { users: [i.user.id], roles: [staffId] }
    });
    await sleep(SPEED);
    await message.edit({ embeds: [embed('✨ Binubuksan ang ticket..', `\`${bar(80)}\``)] });
    await sleep(SPEED);
    await message.edit({
      embeds: [success('🎫 Bukas na ang Ticket', 'Ilagay dito ang concern mo. Hintayin ang staff.')],
      components: [button('ticket_close', 'Close Ticket', ButtonStyle.Danger, '🔒')]
    });
  } catch (err) {
    // Burahin ang kalahating ticket para makapagbukas ulit ang user
    await channel.delete('Pumalya ang pag-setup ng ticket').catch(console.error);
    throw err;
  }
  return success('✅ Nagawa ang ticket!', `Pumunta sa <#${channel.id}>`);
}

async function handleTicketOpen(i, staffId, categoryId) {
  if (openingTicket.has(i.user.id)) return warn(i, 'Ginagawa pa ang ticket mo.');
  openingTicket.add(i.user.id);
  try {
    await deliver(i, 'Gumagawa ng ticket', () => createTicket(i, staffId, categoryId), true);
  } finally {
    openingTicket.delete(i.user.id);
  }
}

// Puwedeng mag-close: may-ari ng ticket, staff, o may Manage Channels
function ticketAccess(i) {
  const [tag, ownerId, staffId] = (i.channel.topic ?? '').split(':');
  if (tag !== 'ticket') return false;
  return i.user.id === ownerId || i.member.roles.cache.has(staffId) ||
    i.memberPermissions.has(PermissionFlagsBits.ManageChannels);
}

async function handleTicketClose(i) {
  if (!ticketAccess(i)) return warn(i, 'Hindi mo puwedeng isara ang ticket na ito.');
  await deliver(i, 'Sandali', {
    embeds: [notice('⚠️ Sigurado ka?', 'Mabubura ang channel at lahat ng messages dito.')],
    components: [button('ticket_confirm', 'Oo, isara', ButtonStyle.Danger, '🗑️')]
  }, true);
}

async function handleTicketConfirm(i) {
  if (!ticketAccess(i)) return warn(i, 'Hindi mo puwedeng isara ang ticket na ito.');
  if (closingTicket.has(i.channelId)) return warn(i, 'Isinasara na.');
  closingTicket.add(i.channelId);
  try {
    const frames = [3, 2, 1].map(n => embed('🔒 Isinasara ang ticket', `# ${n}`, RED));
    await animate(i, frames, embed('👋 Paalam!', 'Binubura na ang channel.', RED), 1000);
    await i.channel.delete(`Isinara ni ${i.user.username}`);
  } finally {
    closingTicket.delete(i.channelId);
  }
}

function handleButton(i) {
  const [action, a, b] = i.customId.split(':');
  if (action === 'verify') return handleVerify(i, a);
  if (action === 'ticket_open') return handleTicketOpen(i, a, b);
  if (action === 'ticket_close') return handleTicketClose(i);
  if (action === 'ticket_confirm') return handleTicketConfirm(i);
  return warn(i, 'Luma na ang button na ito. Ipa-setup ulit sa admin.');
}

/* ========== Animated status ========== */
function startStatus() {
  const statuses = [
    () => ({ name: '/help para sa commands', type: ActivityType.Listening }),
    () => ({ name: `${client.guilds.cache.size} server(s)`, type: ActivityType.Watching }),
    () => ({ name: 'trivia, tictactoe at slots 🎰', type: ActivityType.Playing }),
    () => ({ name: 'custom', type: ActivityType.Custom, state: '✨ Online na ✨' })
  ];
  let index = 0;
  const update = () => {
    const activity = statuses[index++ % statuses.length]();
    client.user.setPresence({ status: 'online', activities: [activity] });
  };
  update();
  setInterval(update, 20_000); // huwag masyadong mabilis dahil may rate limit
}

/* ========== Events ========== */
client.once(Events.ClientReady, async c => {
  console.log(`Online na si ${c.user.tag}`);
  startStatus();
  try {
    await c.application.commands.set([...commands.values()].map(cmd => cmd.data.toJSON()));
    console.log(`Na-register na ang commands (${commands.size})`);
  } catch (err) {
    console.error('Hindi na-register ang commands:', err);
  }
  // Linisin ang lumang cooldown entries
  setInterval(() => {
    const now = Date.now();
    for (const [key, time] of xpCooldown) if (now - time > XP_COOLDOWN) xpCooldown.delete(key);
  }, 10 * 60_000);
});

client.on(Events.InteractionCreate, async i => {
  // Ang buttons na may "local:" ay hawak ng sarili nilang collector (trivia, tictactoe, dashboard)
  if (i.isButton() && i.customId.startsWith('local:')) return;
  if (!i.inCachedGuild() || !(i.isChatInputCommand() || i.isButton())) return;
  const label = i.isButton() ? `button ${i.customId}` : `/${i.commandName}`;
  try {
    if (i.isButton()) return await handleButton(i);
    const command = commands.get(i.commandName);
    if (!command) return;
    // Dobleng check ng permission ng gumagamit
    if (command.permission && !i.memberPermissions.has(command.permission)) {
      return await warn(i, 'Wala kang permission para dito.');
    }
    await command.run(i);
  } catch (err) {
    console.error(`Error sa ${label}:`, err);
    // Animated din ang error, at pinapalitan ang loading message
    try {
      const error = fail('May error. Tingnan ang permissions ng bot.');
      if (i.replied || i.deferred) {
        await i.editReply({ content: '', embeds: [notice('⚠️ May problema...', 'Sandali lang.')], components: [] });
        await sleep(SPEED);
        await i.editReply({ embeds: [error] });
      } else {
        await deliver(i, 'Sinusuri', error, true);
      }
    } catch (replyError) {
      console.error('Hindi maipakita ang error:', replyError.message);
    }
  }
});

// XP kada message (may 60s cooldown bawat user)
client.on(Events.MessageCreate, async m => {
  if (!m.inGuild() || m.author.bot) return;
  const key = `${m.guildId}:${m.author.id}`;
  const now = Date.now();
  if (now - (xpCooldown.get(key) ?? 0) < XP_COOLDOWN) return;
  xpCooldown.set(key, now);
  const { leveled, user } = addXp(m.guildId, m.author.id, randInt(15, 25));
  if (leveled) await announceLevelUp(m, user).catch(err => console.error('Level up error:', err.message));
});

// Welcome: animated, may card na larawan, at reactions
client.on(Events.GuildMemberAdd, async member => {
  if (!WELCOME_CHANNEL_ID) return;
  try {
    const channel = await member.guild.channels.fetch(WELCOME_CHANNEL_ID);
    if (!channel?.isTextBased()) return;
    const welcome = text => embed('🎉 Bagong Member!', text).setThumbnail(member.user.displayAvatarURL({ size: 256 }));
    const message = await channel.send({ content: `${member}`, embeds: [welcome('👋 ...')] });
    for (const text of ['👋 Welcome...', '👋 Welcome sa server...']) {
      await sleep(400);
      await message.edit({ embeds: [welcome(text)] });
    }
    await sleep(400);

    let card = null;
    if (canvasLib) {
      try {
        card = new AttachmentBuilder(await drawCard({
          avatarUrl: avatarOf(member.user),
          title: member.displayName,
          subtitle: 'Welcome sa server! 🎉',
          footer: `Member #${member.guild.memberCount} • ${member.guild.name}`,
          accent: '#22c55e'
        }), { name: 'welcome.png' });
      } catch (err) {
        console.error('Welcome card error:', err.message);
      }
    }
    const text = `🥳 Welcome sa **${member.guild.name}**, ${member}!\nIkaw ang member **#${member.guild.memberCount}**.`;
    if (card) {
      await message.edit({ embeds: [embed('🎉 Bagong Member!', text, GREEN).setImage('attachment://welcome.png')], files: [card] });
    } else {
      await message.edit({ embeds: [welcome(text)] });
    }
    for (const e of ['👋', '🎉', '🥳']) {
      await sleep(300);
      await message.react(e).catch(() => {});
    }
  } catch (err) {
    console.error('Welcome error:', err.message);
  }
});

client.on(Events.Error, err => console.error('Client error:', err));
process.on('unhandledRejection', err => console.error('Unhandled error:', err));

client.login(DISCORD_TOKEN).catch(err => {
  console.error('Hindi maka-login:', err.message);
  process.exit(1);
});
