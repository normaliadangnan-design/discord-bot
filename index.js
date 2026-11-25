require('dotenv').config();
const {
  Client, GatewayIntentBits, Events, SlashCommandBuilder, EmbedBuilder,
  PermissionFlagsBits, MessageFlags, ActivityType, InteractionContextType,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType
} = require('discord.js');

const { DISCORD_TOKEN, WELCOME_CHANNEL_ID } = process.env;
if (!DISCORD_TOKEN) {
  console.error('Walang DISCORD_TOKEN sa environment variables');
  process.exit(1);
}

const intents = [GatewayIntentBits.Guilds];
if (WELCOME_CHANNEL_ID) intents.push(GatewayIntentBits.GuildMembers);
const client = new Client({ intents });

/* ========== Helpers ========== */
const COLOR = 0x8b5cf6;
const SPEED = 300; // bilis ng animation sa milliseconds (mas mababa = mas mabilis)
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pick = list => list[Math.floor(Math.random() * list.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const embed = (title, text) => {
  const e = new EmbedBuilder().setColor(COLOR).setTitle(title);
  if (text) e.setDescription(text);
  return e;
};
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
const warn = (i, text) => deliver(i, 'Sinusuri', { content: text }, true);

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
  await deliver(i, 'Nagta-type',
    { content: i.options.getString('message', true), allowedMentions: { parse: [] } });
}, c => c.addStringOption(o => o.setName('message').setDescription('Sasabihin').setRequired(true).setMaxLength(2000)),
PermissionFlagsBits.ManageMessages);

add('poll', 'Gumawa ng botohan (24 oras)', async i => {
  // Hindi puwedeng idagdag ang poll sa pag-edit, kaya bagong message ito pagkatapos ng animation
  await deliver(i, 'Ginagawa ang botohan', embed('📊 Handa na ang botohan!'));
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

add('countdown', 'Animated na countdown', async i => {
  const n = i.options.getInteger('segundo') ?? 5;
  const frames = Array.from({ length: n }, (_, x) => embed('⏳ Countdown', `# ${n - x}`));
  await animate(i, frames, embed('🚀 GO!'), 1000);
}, c => c.addIntegerOption(o => o.setName('segundo').setDescription('3 hanggang 10').setMinValue(3).setMaxValue(10)));

add('loading', 'Animated na loading bar', async i => {
  const frames = [0, 30, 70].map(p => embed('⚙️ Loading...', `\`${bar(p)}\` ${p}%`));
  await animate(i, frames, embed('✅ Tapos na!', `\`${bar(100)}\` 100%`), SPEED);
});

/* ----- Moderation ----- */
add('clear', 'Magbura ng messages', async i => {
  if (!i.appPermissions.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ReadMessageHistory])) {
    return warn(i, '❌ Kailangan ko ng View Channel, Manage Messages at Read Message History.');
  }
  await deliver(i, 'Naglilinis', async () => {
    const deleted = await i.channel.bulkDelete(i.options.getInteger('dami', true), true);
    return embed('🧹 Tapos na!', `Nabura: **${deleted.size}** (hindi mabubura nang sabay ang lampas 14 na araw)`);
  }, true);
}, c => c.addIntegerOption(o => o.setName('dami').setDescription('1 hanggang 100').setRequired(true).setMinValue(1).setMaxValue(100)),
PermissionFlagsBits.ManageMessages);

// Safety check: bawal sa sarili, sa bot, at sa mas mataas o kapantay na role
async function getTarget(i) {
  const user = i.options.getUser('user', true);
  const member = await i.guild.members.fetch(user.id).catch(() => null);
  let problem = null;
  if (!member) problem = 'Wala sa server ang user.';
  else if (user.id === i.user.id || user.id === client.user.id) problem = 'Hindi puwede sa sarili mo o sa bot.';
  else if (i.guild.ownerId !== i.user.id && member.roles.highest.comparePositionTo(i.member.roles.highest) >= 0) {
    problem = 'Mas mataas o kapantay mo ang role niya.';
  }
  return { member, problem };
}

function addModeration(name, description, permission, check, action, extra) {
  add(name, description, async i => {
    const { member, problem } = await getTarget(i);
    if (problem) return warn(i, `❌ ${problem}`);
    if (!i.appPermissions.has(permission) || !member[check]) {
      return warn(i, '❌ Kulang ang permission ng bot, o mas mataas ang role ng user.');
    }
    const reason = i.options.getString('dahilan') ?? 'Walang dahilan';
    await deliver(i, 'Pinoproseso', async () => {
      const done = await action(i, member, `${i.user.username}: ${reason}`.slice(0, 512));
      return { content: `✅ ${done}: **${member.user.username}**\nDahilan: ${reason}`, allowedMentions: { parse: [] } };
    });
  }, c => {
    c.addUserOption(o => o.setName('user').setDescription('Target').setRequired(true));
    if (extra) extra(c);
    c.addStringOption(o => o.setName('dahilan').setDescription('Dahilan').setMaxLength(400));
  }, permission);
}

addModeration('timeout', 'I-timeout ang user', PermissionFlagsBits.ModerateMembers, 'moderatable',
  async (i, member, reason) => {
    const minutes = i.options.getInteger('minuto', true);
    await member.timeout(minutes * 60_000, reason);
    return `Na-timeout nang ${minutes} minuto`;
  },
  c => c.addIntegerOption(o => o.setName('minuto').setDescription('Ilang minuto').setRequired(true).setMinValue(1).setMaxValue(40320)));

addModeration('untimeout', 'Alisin ang timeout', PermissionFlagsBits.ModerateMembers, 'moderatable',
  async (i, member, reason) => { await member.timeout(null, reason); return 'Inalis ang timeout'; });

addModeration('kick', 'I-kick ang user', PermissionFlagsBits.KickMembers, 'kickable',
  async (i, member, reason) => { await member.kick(reason); return 'Na-kick'; });

addModeration('ban', 'I-ban ang user', PermissionFlagsBits.BanMembers, 'bannable',
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
  if (!i.appPermissions.has(needed)) return warn(i, '❌ Kailangan ko ng View Channel, Send Messages at Embed Links.');
  await deliver(i, 'Ipinapadala', async () => {
    await i.channel.send({ embeds: [embed('📢 Announcement', i.options.getString('message', true))] });
    return { content: '✅ Naipadala na!' };
  }, true);
}, c => c.addStringOption(o => o.setName('message').setDescription('Announcement').setRequired(true).setMaxLength(2000)),
PermissionFlagsBits.ManageMessages);

add('slowmode', 'Itakda ang slowmode ng channel', async i => {
  if (!i.appPermissions.has(PermissionFlagsBits.ManageChannels)) return warn(i, '❌ Kailangan ko ng Manage Channels.');
  const seconds = i.options.getInteger('segundo', true);
  await deliver(i, 'Inaayos', async () => {
    await i.channel.setRateLimitPerUser(seconds);
    return embed('🐢 Slowmode', seconds ? `Naka-set sa **${seconds}s**` : 'Naka-off na');
  });
}, c => c.addIntegerOption(o => o.setName('segundo').setDescription('0 para i-off').setRequired(true).setMinValue(0).setMaxValue(21600)),
PermissionFlagsBits.ManageChannels);

function addLock(name, description, value, message) {
  add(name, description, async i => {
    if (!i.appPermissions.has([PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles])) {
      return warn(i, '❌ Kailangan ko ng Manage Channels at Manage Roles.');
    }
    if (i.channel.type !== ChannelType.GuildText) return warn(i, '❌ Sa text channel lang ito puwede.');
    await deliver(i, 'Inaayos', async () => {
      await i.channel.permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: value });
      return embed(message);
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
  const message = await channel.send({ embeds: [embed('⏳ Inihahanda...')] });
  await sleep(SPEED);
  await message.edit({ embeds: [embed(title, text)], components: [row] });
}

const panelPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];

add('setup-verify', 'Maglagay ng verify button sa channel na ito', async i => {
  const role = i.options.getRole('role', true);
  if (!i.appPermissions.has([...panelPermissions, PermissionFlagsBits.ManageRoles])) {
    return warn(i, '❌ Kailangan ko ng View Channel, Send Messages, Embed Links at Manage Roles.');
  }
  if (!safeRole(i.guild, role)) {
    return warn(i, '❌ Hindi puwede ang role na ito. Dapat mas mababa sa role ng bot at walang admin o moderation permission.');
  }
  if (i.guild.ownerId !== i.user.id && role.comparePositionTo(i.member.roles.highest) >= 0) {
    return warn(i, '❌ Dapat mas mababa ang role kaysa sa pinakamataas mong role.');
  }
  await deliver(i, 'Sine-setup', async () => {
    await sendPanel(i.channel, '✅ Verification', `Pindutin ang button para makuha ang <@&${role.id}> role.`,
      button(`verify:${role.id}`, 'Verify', ButtonStyle.Success, '✅'));
    return { content: '✅ Naka-setup na ang verification!' };
  }, true);
}, c => c.addRoleOption(o => o.setName('role').setDescription('Role na ibibigay').setRequired(true)),
PermissionFlagsBits.Administrator);

add('setup-ticket', 'Maglagay ng ticket button sa channel na ito', async i => {
  const staff = i.options.getRole('staff', true);
  const category = i.options.getChannel('category');
  if (!i.appPermissions.has([...panelPermissions, PermissionFlagsBits.ManageChannels])) {
    return warn(i, '❌ Kailangan ko ng View Channel, Send Messages, Embed Links at Manage Channels.');
  }
  if (staff.id === i.guild.id) return warn(i, '❌ Hindi puwedeng @everyone ang staff role.');
  await deliver(i, 'Sine-setup', async () => {
    await sendPanel(i.channel, '🎫 Support Ticket', 'Kailangan ng tulong? Pindutin ang button para magbukas ng ticket.',
      button(`ticket_open:${staff.id}:${category?.id ?? i.channel.parentId ?? '0'}`, 'Open Ticket', ButtonStyle.Primary, '🎫'));
    return { content: '✅ Naka-setup na ang ticket system!' };
  }, true);
}, c => c
  .addRoleOption(o => o.setName('staff').setDescription('Role na sasagot sa tickets').setRequired(true))
  .addChannelOption(o => o.setName('category').setDescription('Category ng mga ticket').addChannelTypes(ChannelType.GuildCategory)),
PermissionFlagsBits.Administrator);

const openingTicket = new Set(); // iwas dobleng ticket kapag sunod-sunod ang pindot
const closingTicket = new Set();

async function handleVerify(i, roleId) {
  await deliver(i, 'Vine-verify', async () => {
    const role = await i.guild.roles.fetch(roleId);
    if (!safeRole(i.guild, role)) return { content: '❌ Hindi maibigay ang role. Sabihan ang admin.' };
    if (i.member.roles.cache.has(role.id)) return { content: 'ℹ️ Verified ka na!' };
    await i.member.roles.add(role, 'Verify button');
    return embed('🎉 Verified!', `Nakuha mo na ang <@&${role.id}> role.`);
  }, true);
}

async function createTicket(i, staffId, categoryId) {
  const channels = await i.guild.channels.fetch();
  const existing = channels.find(c => c?.topic?.startsWith(`ticket:${i.user.id}:`));
  if (existing) return { content: `ℹ️ May bukas ka pang ticket: <#${existing.id}>` };

  const staff = await i.guild.roles.fetch(staffId);
  if (!staff) return { content: '❌ Wala na ang staff role. Ipa-setup ulit sa admin.' };

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
  await channel.send({
    content: `<@${i.user.id}> <@&${staffId}>`,
    embeds: [embed('🎫 Bukas na ang Ticket', 'Ilagay dito ang concern mo. Hintayin ang staff.')],
    components: [button('ticket_close', 'Close Ticket', ButtonStyle.Danger, '🔒')],
    allowedMentions: { users: [i.user.id], roles: [staffId] }
  });
  return embed('✅ Nagawa ang ticket!', `Pumunta sa <#${channel.id}>`);
}

async function handleTicketOpen(i, staffId, categoryId) {
  if (openingTicket.has(i.user.id)) return warn(i, '⏳ Ginagawa pa ang ticket mo.');
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
  if (!ticketAccess(i)) return warn(i, '❌ Hindi mo puwedeng isara ang ticket na ito.');
  await deliver(i, 'Sandali', {
    content: '⚠️ Sigurado ka? Mabubura ang channel at lahat ng messages dito.',
    components: [button('ticket_confirm', 'Oo, isara', ButtonStyle.Danger, '🗑️')]
  }, true);
}

async function handleTicketConfirm(i) {
  if (!ticketAccess(i)) return warn(i, '❌ Hindi mo puwedeng isara ang ticket na ito.');
  if (closingTicket.has(i.channelId)) return warn(i, '⏳ Isinasara na.');
  closingTicket.add(i.channelId);
  try {
    const frames = [3, 2, 1].map(n => embed('🔒 Isinasara ang ticket', `# ${n}`));
    await animate(i, frames, embed('👋 Paalam!'), 1000);
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
}

/* ========== Animated status ========== */
function startStatus() {
  const statuses = [
    () => ({ name: '/help para sa commands', type: ActivityType.Listening }),
    () => ({ name: `${client.guilds.cache.size} server(s)`, type: ActivityType.Watching }),
    () => ({ name: 'slots at rps 🎰', type: ActivityType.Playing }),
    () => ({ name: '✨ Online na ✨', type: ActivityType.Custom })
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
});

client.on(Events.InteractionCreate, async i => {
  if (!i.inCachedGuild() || !(i.isChatInputCommand() || i.isButton())) return;
  const label = i.isButton() ? `button ${i.customId}` : `/${i.commandName}`;
  try {
    if (i.isButton()) return await handleButton(i);
    const command = commands.get(i.commandName);
    if (!command) return;
    // Dobleng check ng permission ng gumagamit
    if (command.permission && !i.memberPermissions.has(command.permission)) {
      return await warn(i, '❌ Wala kang permission para dito.');
    }
    await command.run(i);
  } catch (err) {
    console.error(`Error sa ${label}:`, err);
    // Palitan ang loading message para hindi ito maiwang nakabitin
    const send = i.replied || i.deferred
      ? i.editReply({ content: '❌ May error. Tingnan ang permissions ng bot.', embeds: [], components: [] })
      : i.reply(secret('❌ May error.'));
    await send.catch(console.error);
  }
});

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
    await message.edit({ embeds: [welcome(`🥳 Welcome sa **${member.guild.name}**, ${member}!`)] });
  } catch (err) {
    console.error('Welcome error:', err.message);
  }
});

client.on(Events.Error, err => console.error('Client error:', err));

client.login(DISCORD_TOKEN).catch(err => {
  console.error('Hindi maka-login:', err.message);
  process.exit(1);
});
