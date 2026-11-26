require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    ActivityType,
    EmbedBuilder,
    Events,
    REST,
    Routes,
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

// ============================================
// CART3R.JAILBREAK v2.0
// ADVANCED ANIMATED DISCORD BOT
// ============================================

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID) {
    throw new Error("Missing DISCORD_TOKEN or CLIENT_ID in .env");
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

const RED = 0xB00020;
const GREEN = 0x00CC66;

const sleep = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

// ============================================
// ANIMATED BOT STATUS
// ============================================

const activities = [
    "⚡ CART3R SYSTEM ONLINE",
    "🔴 CART3R JAILBREAK",
    "🤖 Monitoring servers",
    "💻 JavaScript Development",
    "🌐 Protecting communities",
    "🚀 Ready for commands",
    "👾 Running advanced systems",
    "⚙️ All systems operational"
];

let activityIndex = 0;

function animateStatus() {
    if (!client.user) return;

    client.user.setPresence({
        status: "online",
        activities: [{
            name: activities[activityIndex],
            type: ActivityType.Playing
        }]
    });

    activityIndex =
        (activityIndex + 1) % activities.length;
}

// ============================================
// EMBED GENERATOR
// ============================================

function makeEmbed(title, description, color = RED) {
    return new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description)
        .setFooter({
            text: "CART3R.JAILBREAK • VERSION 2.0"
        })
        .setTimestamp();
}

// ============================================
// SLASH COMMAND DIRECTORY
// ============================================

const commands = [

    // GENERAL
    new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Check bot latency"),

    new SlashCommandBuilder()
        .setName("help")
        .setDescription("Show all bot commands"),

    new SlashCommandBuilder()
        .setName("dashboard")
        .setDescription("Open animated dashboard"),

    new SlashCommandBuilder()
        .setName("animate")
        .setDescription("Test animated bot effects"),

    new SlashCommandBuilder()
        .setName("server")
        .setDescription("Show server information"),

    new SlashCommandBuilder()
        .setName("userinfo")
        .setDescription("Show user information")
        .addUserOption(o =>
            o.setName("member")
                .setDescription("Select a member")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("avatar")
        .setDescription("Show a user's avatar")
        .addUserOption(o =>
            o.setName("member")
                .setDescription("Select a member")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("botinfo")
        .setDescription("Show bot information"),

    new SlashCommandBuilder()
        .setName("uptime")
        .setDescription("Show bot uptime"),

    // FUN
    new SlashCommandBuilder()
        .setName("8ball")
        .setDescription("Ask the magic 8ball")
        .addStringOption(o =>
            o.setName("question")
                .setDescription("Your question")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("coinflip")
        .setDescription("Flip a coin"),

    new SlashCommandBuilder()
        .setName("dice")
        .setDescription("Roll a dice"),

    // COMMUNITY
    new SlashCommandBuilder()
        .setName("poll")
        .setDescription("Create a community poll")
        .addStringOption(o =>
            o.setName("question")
                .setDescription("Poll question")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("option1")
                .setDescription("First option")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("option2")
                .setDescription("Second option")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("say")
        .setDescription("Send a bot message")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageMessages
        )
        .addStringOption(o =>
            o.setName("message")
                .setDescription("Message to send")
                .setRequired(true)
        ),

    // MODERATION
    new SlashCommandBuilder()
        .setName("kick")
        .setDescription("Kick a server member")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.KickMembers
        )
        .addUserOption(o =>
            o.setName("member")
                .setDescription("Member to kick")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("reason")
                .setDescription("Reason")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Ban a server member")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.BanMembers
        )
        .addUserOption(o =>
            o.setName("member")
                .setDescription("Member to ban")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("reason")
                .setDescription("Reason")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("timeout")
        .setDescription("Temporarily timeout a member")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ModerateMembers
        )
        .addUserOption(o =>
            o.setName("member")
                .setDescription("Member to timeout")
                .setRequired(true)
        )
        .addIntegerOption(o =>
            o.setName("minutes")
                .setDescription("Timeout duration in minutes")
                .setMinValue(1)
                .setMaxValue(40320)
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("untimeout")
        .setDescription("Remove a member's timeout")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ModerateMembers
        )
        .addUserOption(o =>
            o.setName("member")
                .setDescription("Member to untimeout")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("clear")
        .setDescription("Delete recent messages")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageMessages
        )
        .addIntegerOption(o =>
            o.setName("amount")
                .setDescription("Number of messages (1-100)")
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("slowmode")
        .setDescription("Change channel slowmode")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageChannels
        )
        .addIntegerOption(o =>
            o.setName("seconds")
                .setDescription("Slowmode seconds (0-21600)")
                .setMinValue(0)
                .setMaxValue(21600)
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("lock")
        .setDescription("Lock the current text channel")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageChannels
        ),

    new SlashCommandBuilder()
        .setName("unlock")
        .setDescription("Unlock the current text channel")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageChannels
        )

].map(command => command.toJSON());

// ============================================
// REGISTER SLASH COMMANDS
// ============================================

async function registerCommands() {
    const rest = new REST({ version: "10" })
        .setToken(TOKEN);

    try {
        console.log("Registering commands...");

        const route = GUILD_ID
            ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
            : Routes.applicationCommands(CLIENT_ID);

        await rest.put(route, {
            body: commands
        });

        console.log(Registered ${commands.length} commands.);
    } catch (error) {
        console.error("Registration error:", error);
    }
}

// ============================================
// STARTUP
// ============================================

client.once(Events.ClientReady, async readyClient => {

    console.log("====================================");
    console.log("CART3R.JAILBREAK");
    console.log(BOT: ${readyClient.user.tag});
    console.log(ID: ${readyClient.user.id});
    console.log("STATUS: ONLINE");
    console.log("VERSION: 2.0");
    console.log("====================================");

    await registerCommands();

    animateStatus();

    setInterval(animateStatus, 10000);
});

// ============================================
// WELCOME SYSTEM
// ============================================

client.on(Events.GuildMemberAdd, async member => {

    const channel = member.guild.systemChannel;
    if (!channel) return;

    const embed = makeEmbed(
        "🔴 NEW MEMBER DETECTED",
        Welcome ${member}!\n\n +
        "You have successfully joined our community.\n" +
        "Enjoy your stay!",
        GREEN
    );

    embed.setThumbnail(member.displayAvatarURL());

    const message = await channel.send({
        content: "⚡ Initializing welcome sequence...",
        embeds: [embed]
    }).catch(console.error);

    if (message) {
        await sleep(1500);

        await message.edit({
            content: "🟢 Welcome sequence completed!",
            embeds: [embed]
        }).catch(console.error);
    }
});

// ============================================
// INTERACTION HANDLER
// ============================================

client.on(Events.InteractionCreate, async interaction => {

    // ========================================
    // DASHBOARD BUTTONS
    // ========================================

    if (interaction.isButton()) {

        if (interaction.customId === "cart3r_refresh") {
            const embed = makeEmbed(
                "🔴 CART3R SYSTEM DASHBOARD",
                "🟢 SYSTEM ONLINE\n\n" +
                ⚡ Latency: ${client.ws.ping}ms\n +
               🌐 Servers: ${client.guilds.cache.size}\n` +
               👥 Users: ${client.users.cache.size}\n` +
                "🤖 Status: OPERATIONAL"
            );

            return interaction.update({
                embeds: [embed]
            });
        }

        if (interaction.customId === "cart3r_commands") {
            return interaction.reply({
                embeds: [
                    makeEmbed(
                        "📚 COMMAND CENTER",
                        commands.map(c => `\`/${c.name}\``).join(" • ")
                    )
                ],
                ephemeral: true
            });
        }

        return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = interaction.commandName;

    try {

        // ====================================
        // PING
        // ====================================

        if (command === "ping") {
            await interaction.reply({
                embeds: [
                    makeEmbed(
                        "⚡ SYSTEM RESPONSE",
                        `Latency: \`${client.ws.ping}ms\``,
                        GREEN
                    )
                ]
            });
        }

        // ====================================
        // HELP
        // ====================================

        else if (command === "help") {

            const embed = makeEmbed(
                "🤖 CART3R COMMAND DIRECTORY",
                "Explore the available commands below."
            );

            embed.addFields(
                {
                    name: "📌 GENERAL",
                    value: "/ping
/help
/dashboard
/animate
/server
/userinfo
/avatar
/botinfo
/uptime"
                },
                {
                    name: "🎮 FUN",
                    value: "/8ball
/coinflip
/dice"
                },
                {
                    name: "🌐 COMMUNITY",
                    value: "/poll
/say"
                },
                {
                    name: "🛡️ MODERATION",
                    value: "/kick
/ban
/timeout
/untimeout
/clear
/slowmode
/lock
/unlock"
                }
            );

            await interaction.reply({
                embeds: [embed]
            });
        }

        // ====================================
        // ANIMATED DASHBOARD
        // ====================================

        else if (command === "dashboard") {

            await interaction.deferReply();

            const frames = [
                "🔴 INITIALIZING CART3R...",
                "🟠 CONNECTING TO SYSTEM...",
                "🟡 CHECKING SERVER STATUS...",
                "🟢 ALL SYSTEMS OPERATIONAL."
            ];

            for (const frame of frames) {
                await interaction.editReply({
                    embeds: [
                        makeEmbed(
                            "⚙️ SYSTEM INITIALIZATION",
                            `\`\`\`\n${frame}\n\`\`\``
                        )
                    ]
                });

                await sleep(700);
            }

            const embed = makeEmbed(
                "🔴 CART3R COMMAND CENTER",
                "```ansi\n" +
                "\u001b[1;31mSYSTEM ONLINE\n" +
                "\u001b[1;32mALL SYSTEMS OPERATIONAL\n" +
                "```"
            );

            embed.addFields(
                {
                    name: "🤖 BOT",
                    value: "ONLINE",
                    inline: true
                },
                {
                    name: "⚡ LATENCY",
                    value: ${client.ws.ping}ms,
                    inline: true
                },
                {
                    name: "🌐 SERVERS",
                    value: ${client.guilds.cache.size},
                    inline: true
                }
            );

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("cart3r_refresh")
                    .setLabel("Refresh")
                    .setEmoji("🔄")
                    .setStyle(ButtonStyle.Danger),

                new ButtonBuilder()
                    .setCustomId("cart3r_commands")
                    .setLabel("Commands")
                    .setEmoji("📚")
                    .setStyle(ButtonStyle.Secondary)
            );

            await interaction.editReply({
                embeds: [embed],
                components: [buttons]
            });
        }

        // ====================================
        // ANIMATION TEST
        // ====================================

        else if (command === "animate") {

            await interaction.deferReply();

            const frames = [
                "🔴 ░░░░░░░░░░ 0%",
                "🟠 ███░░░░░░░ 30%",
                "🟡 ██████░░░░ 60%",
                "🟢 ██████████ 100%"
            ];

            for (const frame of frames) {
                await interaction.editReply({
                    embeds: [
                        makeEmbed(
                            "⚡ CART3R ANIMATION ENGINE",
                            `\`\`\`\n${frame}\n\`\`\``
                        )
                    ]
                });

                await sleep(900);
            }

            await interaction.editReply({
                embeds: [
                    makeEmbed(
                        "🟢 ANIMATION COMPLETE",
                        "All animation frames successfully rendered.",
                        GREEN
                    )
                ]
            });
        }

        // ====================================
        // SERVER INFORMATION
        // ====================================

        else if (command === "server") {

            const guild = interaction.guild;

            if (!guild) {
                return interaction.reply({
                    content: "Server only command.",
                    ephemeral: true
                });
            }

            const embed = makeEmbed(
               🌐 ${guild.name}`,
                "SERVER INFORMATION"
            );

            embed.addFields(
                {
                    name: "Members",
                    value: ${guild.memberCount},
                    inline: true
                },
                {
                    name: "Server ID",
                    value: guild.id,
                    inline: true
                },
                {
                    name: "Created",
                    value: <t:${Math.floor(guild.createdTimestamp / 1000)}:D>,
                    inline: false
                }
            );

            if (guild.iconURL()) {
                embed.setThumbnail(guild.iconURL());
            }

            await interaction.reply({ embeds: [embed] });
        }

        // ====================================
        // USER INFORMATION
        // ====================================

        else if (command === "userinfo") {

            const user =
                interaction.options.getUser("member") ||
                interaction.user;

            const member = interaction.guild
                ? await interaction.guild.members.fetch(user.id).catch(() => null)
                : null;

            const embed = makeEmbed(
               👤 ${user.username}`,
                `User ID: \`${user.id}\``
            );

            embed.setThumbnail(user.displayAvatarURL());

            embed.addFields(
                {
                    name: "Account Created",
                    value: <t:${Math.floor(user.createdTimestamp / 1000)}:R>,
                    inline: true
                },
                {
                    name: "Joined Server",
                    value: member
                        ? <t:${Math.floor(member.joinedTimestamp / 1000)}:R>
                        : "Unknown",
                    inline: true
                }
            );

            await interaction.reply({ embeds: [embed] });
        }

        // ====================================
        // AVATAR
        // ====================================

        else if (command === "avatar") {

            const user =
                interaction.options.getUser("member") ||
                interaction.user;

            const embed = makeEmbed(
               🖼️ ${user.username}'s AVATAR`,
                "Avatar preview"
            );

            embed.setImage(
                user.displayAvatarURL({ size: 1024 })
            );

            await interaction.reply({ embeds: [embed] });
        }

        // ====================================
        // BOT INFORMATION
        // ====================================

        else if (command === "botinfo") {

            const embed = makeEmbed(
                "🤖 CART3R BOT INFORMATION",
                "Advanced Discord development system."
            );

            embed.addFields(
                {
                    name: "Version",
                    value: "2.0",
                    inline: true
                },
                {
                    name: "Library",
                    value: "discord.js v14",
                    inline: true
                },
                {
                    name: "Servers",
                    value: ${client.guilds.cache.size},
                    inline: true
                },
                {
                    name: "Node.js",
                    value: process.version,
                    inline: true
                }
            );

            await interaction.reply({ embeds: [embed] });
        }

        // ====================================
        // UPTIME
        // ====================================

        else if (command === "uptime") {

            const seconds = Math.floor(client.uptime / 1000);

            const days = Math.floor(seconds / 86400);
            const hours = Math.floor((seconds % 86400) / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const remaining = seconds % 60;

            await interaction.reply({
                embeds: [
                    makeEmbed(
                        "⏱️ SYSTEM UPTIME",
                        ${days}d ${hours}h ${minutes}m ${remaining}s,
                        GREEN
                    )
                ]
            });
        }

        // ====================================
        // MAGIC 8 BALL
        // ====================================

        else if (command === "8ball") {

            const answers = [
                "Absolutely yes! 🟢",
                "Definitely!",
                "The future looks promising.",
                "Ask again later.",
                "Cannot predict right now.",
                "Probably not.",
                "The answer is no. 🔴"
            ];

            const question =
                interaction.options.getString("question");

            const answer =
                answers[Math.floor(Math.random() * answers.length)];

            await interaction.reply({
                embeds: [
                    makeEmbed(
                        "🎱 MAGIC 8 BALL",
                        **Question:** ${question}\n\n**Answer:** ${answer}
                    )
                ]
            });
        }

        // ====================================
        // COIN FLIP
        // ====================================

        else if (command === "coinflip") {

            const result =
                Math.random() < 0.5 ? "HEADS 🪙" : "TAILS 🪙";

            await interaction.reply({
                embeds: [
                    makeEmbed("🪙 COIN FLIP", Result: **${result}**)
                ]
            });
        }

        // ====================================
        // DICE
        // ====================================

        else if (command === "dice") {

            const result = Math.floor(Math.random() * 6) + 1;

            await interaction.reply({
                embeds: [
                    makeEmbed(
                        "🎲 DICE ROLL",
                        You rolled a **${result}**!
                    )
                ]
            });
        }

        // ====================================
        // POLL
        // ====================================

        else if (command === "poll") {

            const question =
                interaction.options.getString("question");

            const option1 =
                interaction.options.getString("option1");

            const option2 =
                interaction.options.getString("option2");

            const embed = makeEmbed(
                "📊 COMMUNITY POLL",
               **${question}**\n\n` +
              🔴 ${option1}\nn` +
               🟢 ${option2}`
            );

            const message = await interaction.reply({
                embeds: [embed],
                fetchReply: true
            });

            await message.react("🔴");
            await message.react("🟢");
        }

        // ====================================
        // SAY
        // ====================================

        else if (command === "say") {

            const message =
                interaction.options.getString("message");

            await interaction.reply({
                content: "🟢 Message sent.",
                ephemeral: true
            });

            await interaction.channel.send({
                content: message,
                allowedMentions: { parse: [] }
            });
        }

        // ====================================
        // KICK
        // ====================================

        else if (command === "kick") {

            const user =
                interaction.options.getUser("member");

            const reason =
                interaction.options.getString("reason") ||
                "No reason provided";

            const member = await interaction.guild.members
                .fetch(user.id).catch(() => null);

            if (!member || !member.kickable) {
                return interaction.reply({
                    content: "This member cannot be kicked. Check role hierarchy and bot permissions.",
                    ephemeral: true
                });
            }

            await member.kick(reason);

            await interaction.reply({
                embeds: [
                    makeEmbed(
                        "🔴 MEMBER KICKED",
                        Member: ${user.tag}\nReason: ${reason}
                    )
                ]
            });
        }

        // ====================================
        // BAN
        // ====================================

        else if (command === "ban") {

            const user =
                interaction.options.getUser("member");

            const reason =
                interaction.options.getString("reason") ||
                "No reason provided";

            const member = await interaction.guild.members
                .fetch(user.id).catch(() => null);

            if (member && !member.bannable) {
                return interaction.reply({
                    content: "This member cannot be banned. Check role hierarchy and bot permissions.",
                    ephemeral: true
                });
            }

            await interaction.guild.members.ban(user.id, {
                reason
            });

            await interaction.reply({
                embeds: [
                    makeEmbed(
                        "🔴 MEMBER BANNED",
                        Member: ${user.tag}\nReason: ${reason}
                    )
                ]
            });
        }

        // ====================================
        // TIMEOUT
        // ====================================

        else if (command === "timeout") {

            const user =
                interaction.options.getUser("member");

            const minutes =
                interaction.options.getInteger("minutes");

            const member = await interaction.guild.members
                .fetch(user.id).catch(() => null);

            if (!member || !member.moderatable) {
                return interaction.reply({
                    content: "This member cannot be timed out.",
                    ephemeral: true
                });
            }

            await member.timeout(
                minutes * 60 * 1000,
                "Moderator timeout"
            );

            await interaction.reply({
                embeds: [
                    makeEmbed(
                        "⏳ MEMBER TIMED OUT",
                        ${user.tag} was timed out for ${minutes} minutes.
                    )
                ]
            });
        }

        // ====================================
        // UNTIMEOUT
        // ====================================

        else if (command === "untimeout") {

            const user =
                interaction.options.getUser("member");

            const member = await interaction.guild.members
                .fetch(user.id).catch(() => null);

            if (!member || !member.moderatable) {
                return interaction.reply({
                    content: "This member cannot be modified.",
                    ephemeral: true
                });
            }

            await member.timeout(null, "Timeout removed");

            await interaction.reply({
                embeds: [
                    makeEmbed(
                        "🟢 TIMEOUT REMOVED",
                        ${user.tag} can now participate again.
                    )
                ]
            });
        }

        // ====================================
        // CLEAR MESSAGES
        // ====================================

        else if (command === "clear") {

            const amount =
                interaction.options.getInteger("amount");

            const deleted = await interaction.channel.bulkDelete(
                amount,
                true
            );

            await interaction.reply({
                content:🧹 Deleted ${deleted.size} recent messages. Older messages may be skipped.`,
                ephemeral: true
            });
        }

        // ====================================
        // SLOWMODE
        // ====================================

        else if (command === "slowmode") {

            const seconds =
                interaction.options.getInteger("seconds");

            await interaction.channel.setRateLimitPerUser(seconds);

            await interaction.reply({
                embeds: [
                    makeEmbed(
                        "⏱️ SLOWMODE UPDATED",
                        Slowmode: **${seconds} seconds**
                    )
                ]
            });
        }

        // ====================================
        // LOCK CHANNEL
        // ====================================

        else if (command === "lock") {

            await interaction.channel.permissionOverwrites.edit(
                interaction.guild.roles.everyone,
                { SendMessages: false }
            );

            await interaction.reply({
                embeds: [
                    makeEmbed(
                        "🔒 CHANNEL LOCKED",
                        "Members can no longer send messages."
                    )
                ]
            });
        }

        // ====================================
        // UNLOCK CHANNEL
        // ====================================

        else if (command === "unlock") {

            await interaction.channel.permissionOverwrites.edit(
                interaction.guild.roles.everyone,
                { SendMessages: null }
            );

            await interaction.reply({
                embeds: [
                    makeEmbed(
                        "🔓 CHANNEL UNLOCKED",
                        "The default channel permission has been restored."
                    ),
                    makeEmbed(
                        "🟢 CHANNEL STATUS",
                        "Channel unlocked successfully.",
                        GREEN
                    )
                ]
            });
        }

    } catch (error) {

        console.error("COMMAND ERROR:", error);

        const response = {
            content: "❌ An error occurred. Check bot permissions and try again.",
            ephemeral: true
        };

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(response).catch(() => {});
        } else {
            await interaction.reply(response).catch(() => {});
        }
    }
});

// ============================================
// GLOBAL ERROR HANDLING
// ============================================

process.on("unhandledRejection", error => {
    console.error("Unhandled rejection:", error);
});

process.on("uncaughtException", error => {
    console.error("Uncaught exception:", error);
});

// ============================================
// LOGIN
// ============================================

client.login(TOKEN);
