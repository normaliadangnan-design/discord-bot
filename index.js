require('dotenv').config();
const {
  Client, GatewayIntentBits, Events, SlashCommandBuilder,
  PermissionFlagsBits, MessageFlags
} = require('discord.js');

const { DISCORD_TOKEN, WELCOME_CHANNEL_ID } = process.env;
if (!DISCORD_TOKEN) {
  console.error('Walang DISCORD_TOKEN sa .env');
  process.exit(1);
}

const intents = [GatewayIntentBits.Guilds];
if (WELCOME_CHANNEL_ID) intents.push(GatewayIntentBits.GuildMembers);
const client = new Client({ intents });

const commands = [
  new SlashCommandBuilder().setName('ping').setDescription('Tingnan ang bilis ng bot'),
  new SlashCommandBuilder().setName('avatar').setDescription('Ipakita ang avatar')
    .addUserOption(o => o.setName('user').setDescription('Kaninong avatar')),
  new SlashCommandBuilder().setName('serverinfo').setDescription('Info ng server'),
  new SlashCommandBuilder().setName('say').setDescription('Magsalita ang bot')
    .addStringOption(o => o.setName('message').setDescription('Sasabihin')
      .setRequired(true).setMaxLength(2000))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
].map(c => c.setDMPermission(false).toJSON());

client.once(Events.ClientReady, async c => {
  console.log(`Online na si ${c.user.tag}`);
  try {
    await c.application.commands.set(commands); // pinapalitan ang lahat ng global commands
    console.log('Na-register na ang commands');
  } catch (err) {
    console.error('Hindi na-register ang commands:', err);
  }
});

client.on(Events.InteractionCreate, async i => {
  if (!i.isChatInputCommand() || !i.inGuild()) return;
  try {
    if (i.commandName === 'ping') {
      await i.reply(`🏓 Pong! ${client.ws.ping}ms`);
    } else if (i.commandName === 'avatar') {
      const user = i.options.getUser('user') ?? i.user;
      await i.reply(user.displayAvatarURL({ size: 1024 }));
    } else if (i.commandName === 'serverinfo') {
      const g = await client.guilds.fetch(i.guildId);
      await i.reply(`**${g.name}**\nMembers: ${g.approximateMemberCount ?? g.memberCount}`);
    } else if (i.commandName === 'say') {
      await i.reply({
        content: i.options.getString('message', true),
        allowedMentions: { parse: [] } // iwas @everyone abuse
      });
    }
  } catch (err) {
    console.error(err);
    const msg = { content: '❌ May error.', flags: MessageFlags.Ephemeral };
    const send = i.replied || i.deferred ? i.followUp(msg) : i.reply(msg);
    await send.catch(console.error);
  }
});

client.on(Events.GuildMemberAdd, async member => {
  try {
    const channel = await member.guild.channels.fetch(WELCOME_CHANNEL_ID);
    await channel?.send(`👋 Welcome sa server, ${member}!`);
  } catch (err) {
    console.error('Welcome error:', err.message);
  }
});

client.login(DISCORD_TOKEN).catch(err => {
  console.error('Hindi maka-login:', err.message);
  process.exit(1);
});
