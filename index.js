require('dotenv').config();
const express = require('express');
const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ComponentType,
  EmbedBuilder,
  PermissionsBitField
} = require('discord.js');

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot ist online!'));
app.listen(PORT, () => console.log(`Webserver läuft auf Port ${PORT}`));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// === KONFIGURATION ===
const ALLOWED_CHANNEL = '1388989682053812374'; // Nur dieser Channel erlaubt
const ROLE_PING_ID = '1388296883159437382';   // LobbyPing Rolle

client.once('ready', () => {
  console.log(`✅ Bot ist online als ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'lobby') return;

  if (interaction.channelId !== ALLOWED_CHANNEL) {
    return interaction.reply({
      content: `❌ Du kannst diesen Befehl nur im <#${ALLOWED_CHANNEL}> verwenden.`,
      ephemeral: true
    });
  }

  const map = interaction.options.getString('map');
  const mode = interaction.options.getString('modus');
  const teamSize = parseInt(interaction.options.getString('team'));

  const playersA = [];
  const playersB = [];

  const embed = new EmbedBuilder()
    .setTitle('🎮 Neue Lobby erstellt')
    .setColor(0x00ffcc)
    .setThumbnail('https://cdn.discordapp.com/attachments/1263943643346239619/1387888063807492267/image.png')
    .addFields(
      { name: '📍 Map', value: map, inline: true },
      { name: '🚗 Modus', value: mode, inline: true },
      { name: '👥 Teamgröße', value: `${teamSize} vs ${teamSize}`, inline: true },
      { name: '🎟️ Host', value: `<@${interaction.user.id}>` },
      {
        name: '🅰 Lobby A & 🅱 Lobby B',
        value: `**Lobby A:** *(0/${teamSize})*\n**Lobby B:** *(0/${teamSize})*\n\n**Freie Plätze A:** ${teamSize}\n**Freie Plätze B:** ${teamSize}`
      }
    )
    .setFooter({ text: 'Wähle ein Team, um beizutreten.' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('join_a').setLabel('🅰 Lobby A').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('join_b').setLabel('🅱 Lobby B').setStyle(ButtonStyle.Secondary)
  );

  // 👉 Nur diese Nachricht posten – als Antwort
  const msg = await interaction.reply({
    content: `<@&${ROLE_PING_ID}>`,
    embeds: [embed],
    components: [row],
    fetchReply: true // damit wir sie für Button-Collector verwenden können
  });

  const collector = msg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 30 * 60 * 1000
  });

  collector.on('collect', async i => {
    const userId = i.user.id;
    const userMention = `<@${userId}>`;

    // Prüfen ob User schon drin ist
    if (playersA.includes(userId) || playersB.includes(userId)) {
      return i.reply({ content: '❗ Du bist bereits in einem Team.', ephemeral: true });
    }

    // Team beitreten
    if (i.customId === 'join_a') {
      if (playersA.length >= teamSize) {
        return i.reply({ content: '🅰 Lobby A ist voll.', ephemeral: true });
      }
      playersA.push(userId);
    } else if (i.customId === 'join_b') {
      if (playersB.length >= teamSize) {
        return i.reply({ content: '🅱 Lobby B ist voll.', ephemeral: true });
      }
      playersB.push(userId);
    }

    // Embed aktualisieren
    const updatedEmbed = EmbedBuilder.from(embed).setFields(
      { name: '📍 Map', value: map, inline: true },
      { name: '🚗 Modus', value: mode, inline: true },
      { name: '👥 Teamgröße', value: `${teamSize} vs ${teamSize}`, inline: true },
      { name: '🎟️ Host', value: `<@${interaction.user.id}>` },
      {
        name: '🅰 Lobby A & 🅱 Lobby B',
        value: `**Lobby A:** ${playersA.map(id => `<@${id}>`).join(', ') || '*(0)*'}\n` +
               `**Lobby B:** ${playersB.map(id => `<@${id}>`).join(', ') || '*(0)*'}\n\n` +
               `**Freie Plätze A:** ${teamSize - playersA.length}\n` +
               `**Freie Plätze B:** ${teamSize - playersB.length}`
      }
    );

    await i.update({ embeds: [updatedEmbed] });

    // Beide Teams voll → Ticket eröffnen
    if (playersA.length === teamSize && playersB.length === teamSize) {
      collector.stop();

      const category = interaction.guild.channels.cache.find(c =>
        c.type === ChannelType.GuildCategory &&
        c.name.toLowerCase().includes('lobby')
      );

      const ticket = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: category?.id || null,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          ...playersA.concat(playersB).map(id => ({
            id,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
          }))
        ]
      });

      const closeButton = new ButtonBuilder()
        .setCustomId('close_ticket')
        .setLabel('🔒 Ticket schließen')
        .setStyle(ButtonStyle.Danger);

      const ticketRow = new ActionRowBuilder().addComponents(closeButton);

      await ticket.send({
        content: `Willkommen ${playersA.concat(playersB).map(id => `<@${id}>`).join(', ')}!`,
        components: [ticketRow]
      });

      const ticketCollector = ticket.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60 * 60 * 1000
      });

      ticketCollector.on('collect', async btn => {
        if (btn.customId === 'close_ticket') {
          await btn.reply('🔒 Ticket wird geschlossen...');
          ticket.delete().catch(() => {});
        }
      });

      await msg.edit({ content: '✅ Lobby voll – Ticket wurde erstellt!', components: [] });
    }
  });
});

client.login(process.env.TOKEN);
