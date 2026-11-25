require('dotenv').config();
const {
  Client, GatewayIntentBits, Events, SlashCommandBuilder, EmbedBuilder,
  PermissionFlagsBits, MessageFlags, ActivityType, InteractionContextType
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
async function animate(i, frames, final, delay = 900) {
  await i.reply({ embeds: [frames[0]] });
  for (const frame of frames.slice(1)) {
    await sleep(delay);
    await i.editReply({ embeds: [frame] });
  }
  await sleep(delay);
  await i.editReply({ embeds: [final] });
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
  await i.reply({ embeds: [embed('📖 Mga Command', list.join('\n'))], flags: MessageFlags.Ephemeral });
});

add('ping', 'Tingnan ang bilis ng bot', async i => {
  const ping = client.ws.ping < 0 ? 'sinusukat pa' : `${Math.round(client.ws.ping)}ms`;
  await animate(i,
    [embed('🏓 Ping.'), embed('🏓 Ping..'), embed('🏓 Ping...')],
    embed('🏓 Pong!', `Latency: **${ping}**`), 500);
});

add('uptime', 'Gaano na katagal online ang bot', async i => {
  const since = Math.floor((Date.now() - client.uptime) / 1000);
  await i.reply(`⏱️ Online mula <t:${since}:R>`);
});

add('avatar', 'Ipakita ang avatar', async i => {
  const user = i.options.getUser('user') ?? i.user;
  await i.reply({ embeds: [embed(`🖼️ Avatar ni ${user.username}`).setImage(user.displayAvatarURL({ size: 1024 }))] });
}, c => c.addUserOption(o => o.setName('user').setDescription('Kaninong avatar')));

add('userinfo', 'Info ng isang user', async i => {
  const user = i.options.getUser('user') ?? i.user;
  const member = await i.guild.members.fetch(user.id).catch(() => null);
  const lines = [
    `**Username:** ${user.username}`,
    `**ID:** ${user.id}`,
    `**Account ginawa:** <t:${Math.floor(user.createdTimestamp / 1000)}:D>`
  ];
  if (member?.joinedTimestamp) lines.push(`**Sumali sa server:** <t:${Math.floor(member.joinedTimestamp / 1000)}:D>`);
  await i.reply({ embeds: [embed('👤 User Info', lines.join('\n')).setThumbnail(user.displayAvatarURL())] });
}, c => c.addUserOption(o => o.setName('user').setDescription('Sinong user')));

add('serverinfo', 'Info ng server', async i => {
  const g = await client.guilds.fetch({ guild: i.guildId, force: true });
  const e = embed(`🏠 ${g.name}`, [
    `**Members:** ${g.approximateMemberCount ?? g.memberCount}`,
    `**Ginawa:** <t:${Math.floor(g.createdTimestamp / 1000)}:D>`,
    `**Boosts:** ${g.premiumSubscriptionCount ?? 0}`
  ].join('\n'));
  if (g.iconURL()) e.setThumbnail(g.iconURL({ size: 256 }));
  await i.reply({ embeds: [e] });
});

add('say', 'Magsalita ang bot', async i => {
  await i.reply({ content: i.options.getString('message', true), allowedMentions: { parse: [] } });
}, c => c.addStringOption(o => o.setName('message').setDescription('Sasabihin').setRequired(true).setMaxLength(2000)),
PermissionFlagsBits.ManageMessages);

add('poll', 'Gumawa ng botohan (24 oras)', async i => {
  await i.reply({
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
    embed('🪙 Resulta', `**${pick(['Heads (Tao)', 'Tails (Ibon)'])}!**`), 600);
});

add('dice', 'Magpagulong ng dice', async i => {
  const frames = ['🎲 Gumugulong.', '🎲 Gumugulong..', '🎲 Gumugulong...'].map(t => embed(t));
  await animate(i, frames, embed('🎲 Resulta', `Lumabas: **${randInt(1, 6)}**`), 600);
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
  await animate(i, frames, embed(verdict, `# ${result.join(' | ')}`), 800);
});

add('8ball', 'Magtanong sa magic 8ball', async i => {
  const question = i.options.getString('tanong', true);
  const answer = pick(['Oo naman!', 'Hindi.', 'Siguro.', 'Malabo yan.', 'Sigurado ako, oo!', 'Tanong ka ulit mamaya.']);
  await animate(i,
    [embed('🎱 Nag-iisip.'), embed('🎱 Nag-iisip..'), embed('🎱 Nag-iisip...')],
    embed('🎱 Magic 8Ball', `**Tanong:** ${question}\n**Sagot:** ${answer}`), 600);
}, c => c.addStringOption(o => o.setName('tanong').setDescription('Tanong mo').setRequired(true).setMaxLength(300)));

add('rps', 'Bato bato pick laban sa bot', async i => {
  const names = { bato: '🪨 Bato', papel: '📄 Papel', gunting: '✂️ Gunting' };
  const beats = { bato: 'gunting', papel: 'bato', gunting: 'papel' };
  const you = i.options.getString('pili', true);
  const bot = pick(Object.keys(names));
  const result = you === bot ? '🤝 Tabla!' : beats[you] === bot ? '🎉 Panalo ka!' : '🤖 Panalo ako!';
  await animate(i,
    [embed('🪨 Bato...'), embed('📄 Bato... Bato...'), embed('✂️ Bato... Bato... PICK!')],
    embed(result, `Ikaw: ${names[you]}\nBot: ${names[bot]}`), 700);
}, c => c.addStringOption(o => o.setName('pili').setDescription('Pili mo').setRequired(true)
  .addChoices({ name: 'Bato', value: 'bato' }, { name: 'Papel', value: 'papel' }, { name: 'Gunting', value: 'gunting' })));

add('love', 'Love meter ng dalawang user (katuwaan lang)', async i => {
  const a = i.options.getUser('user1', true);
  const b = i.options.getUser('user2') ?? i.user;
  const score = randInt(0, 100);
  const frames = [10, 40, 70].map(p => embed('💘 Kinakalkula...', `\`${bar(p)}\``));
  await animate(i, frames, embed('💘 Love Meter', `${a} ❤️ ${b}\n\`${bar(score)}\` **${score}%**`), 700);
}, c => c
  .addUserOption(o => o.setName('user1').setDescription('Unang user').setRequired(true))
  .addUserOption(o => o.setName('user2').setDescription('Pangalawang user (default: ikaw)')));

add('choose', 'Pipili ang bot para sa iyo', async i => {
  const options = i.options.getString('choices', true).split(',').map(s => s.trim()).filter(Boolean);
  if (options.length < 2) return i.reply(secret('Maglagay ng 2 o higit pa, paghiwalayin ng kuwit.'));
  await animate(i,
    [embed('🤔 Namimili.'), embed('🤔 Namimili..'), embed('🤔 Namimili...')],
    embed('✅ Ang pinili ko', pick(options)), 600);
}, c => c.addStringOption(o => o.setName('choices').setDescription('Hal. adobo, sinigang').setRequired(true).setMaxLength(1000)));

add('countdown', 'Animated na countdown', async i => {
  const n = i.options.getInteger('segundo') ?? 5;
  const frames = Array.from({ length: n }, (_, x) => embed('⏳ Countdown', `# ${n - x}`));
  await animate(i, frames, embed('🚀 GO!'), 1000);
}, c => c.addIntegerOption(o => o.setName('segundo').setDescription('3 hanggang 10').setMinValue(3).setMaxValue(10)));

add('loading', 'Animated na loading bar', async i => {
  const frames = [0, 20, 40, 60, 80].map(p => embed('⚙️ Loading...', `\`${bar(p)}\` ${p}%`));
  await animate(i, frames, embed('✅ Tapos na!', `\`${bar(100)}\` 100%`), 800);
});

/* ----- Moderation ----- */
add('clear', 'Magbura ng messages', async i => {
  if (!i.appPermissions.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ReadMessageHistory])) {
    return i.reply(secret('❌ Kailangan ko ng View Channel, Manage Messages at Read Message History.'));
  }
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  const deleted = await i.channel.bulkDelete(i.options.getInteger('dami', true), true);
  await i.editReply(`🧹 Nabura: ${deleted.size} (hindi mabubura nang sabay ang lampas 14 na araw)`);
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
    if (problem) return i.reply(secret(`❌ ${problem}`));
    if (!i.appPermissions.has(permission) || !member[check]) {
      return i.reply(secret('❌ Kulang ang permission ng bot, o mas mataas ang role ng user.'));
    }
    const reason = i.options.getString('dahilan') ?? 'Walang dahilan';
    const done = await action(i, member, `${i.user.username}: ${reason}`.slice(0, 512));
    await i.reply({ content: `✅ ${done}: **${member.user.username}**\nDahilan: ${reason}`, allowedMentions: { parse: [] } });
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
  if (!i.isChatInputCommand() || !i.inCachedGuild()) return;
  const command = commands.get(i.commandName);
  if (!command) return;
  try {
    // Dobleng check ng permission ng gumagamit
    if (command.permission && !i.memberPermissions.has(command.permission)) {
      return await i.reply(secret('❌ Wala kang permission para dito.'));
    }
    await command.run(i);
  } catch (err) {
    console.error(`Error sa /${i.commandName}:`, err);
    const msg = secret('❌ May error.');
    const send = i.replied || i.deferred ? i.followUp(msg) : i.reply(msg);
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
      await sleep(900);
      await message.edit({ embeds: [welcome(text)] });
    }
    await sleep(900);
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
