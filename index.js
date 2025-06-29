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

const ALLOWED_CHANNEL = '1388989682053812374'; // lobby-suche-v2
const ROLE_PING_ID = '1388296883159437382'; // LobbyPing Rolle

client.once('ready', () => {
  console.log(`✅ Bot ist online als ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'lobby') return;

  if (interaction.channelId !== ALLOWED_CHANNEL) {
    return interaction.reply({
      content: `❌ Du kannst diesen Befehl nur im <#${ALLOWED_CHANNEL}> Channel verwenden.`,
      ephemeral: true
    });
  }

  const map = interaction.options.getString('map');
  const mode = interaction.options.getString('modus');
  const teamSize = interaction.options.getString('team');

  const embed = new EmbedBuilder()
    .setTitle('🎮 Neue Lobby erstellt')
    .setColor(0x00ffcc)
    .setThumbnail('https://cdn.discordapp.com/attachments/1263943643346239619/1387888063807492267/image.png')
    .addFields(
      { name: '📍 Map', value: map, inline: true },
      { name: '🚗 Modus', value: mode, inline: true },
      { name: '👥 Teamgröße', value: teamSize, inline: true },
      { name: '🎟️ Host', value: `<@${interaction.user.id}>` },
      { name: '🆚 Teams', value: 'Lobby A: *(0)*\nLobby B: *(0)*' }
    )
    .setFooter({ text: 'Wähle ein Team, um beizutreten.' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('join_a')
      .setLabel('🅰 Lobby A')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('join_b')
      .setLabel('🅱 Lobby B')
      .setStyle(ButtonStyle.Secondary)
  );

  const channel = interaction.guild.channels.cache.get(ALLOWED_CHANNEL);
  const msg = await channel.send({
    content: `<@&${ROLE_PING_ID}>`,
    embeds: [embed],
    components: [row]
  });

  await interaction.reply({ content: '✅ Lobby erstellt!', ephemeral: true });

  const playersA = [];
  const playersB = [];
  const maxPlayersPerTeam = parseInt(teamSize);

  const collector = msg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 30 * 60 * 1000
  });

  collector.on('collect', async i => {
    const userId = i.user.id;
    const username = `<@${userId}>`;

    if (playersA.includes(userId) || playersB.includes(userId)) {
      return i.reply({ content: '❗ Du bist bereits in einer Lobby.', ephemeral: true });
    }

    if (i.customId === 'join_a') {
      if (playersA.length >= maxPlayersPerTeam) {
        return i.reply({ content: '🅰 Lobby A ist bereits voll.', ephemeral: true });
      }
      playersA.push(userId);
    }

    if (i.customId === 'join_b') {
      if (playersB.length >= maxPlayersPerTeam) {
        return i.reply({ content: '🅱 Lobby B ist bereits voll.', ephemeral: true });
      }
      playersB.push(userId);
    }

    const updatedEmbed = EmbedBuilder.from(embed).setFields(
      { name: '📍 Map', value: map, inline: true },
      { name: '🚗 Modus', value: mode, inline: true },
      { name: '👥 Teamgröße', value: teamSize, inline: true },
      { name: '🎟️ Host', value: `<@${interaction.user.id}>` },
      {
        name: '🆚 Teams',
        value: `Lobby A: ${playersA.map(id => `<@${id}>`).join(', ') || '*(0)*'}\nLobby B: ${playersB.map(id => `<@${id}>`).join(', ') || '*(0)*'}`
      }
    );

    await msg.edit({ embeds: [updatedEmbed] });
    await i.deferUpdate();

    // Wenn voll
    if (playersA.length === maxPlayersPerTeam && playersB.length === maxPlayersPerTeam) {
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
