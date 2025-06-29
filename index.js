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

require('./keep_alive.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

client.once('ready', () => {
  console.log(`✅ Bot ist online als ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'lobby') return;

  // Nur in Channel 1388989682053812374
  if (interaction.channel.id !== '1388989682053812374') {
    return interaction.reply({ content: '❌ Du kannst diesen Befehl nur im Channel <#1388989682053812374> benutzen.', ephemeral: true });
  }

  const map = interaction.options.getString('map');
  const mode = interaction.options.getString('modus');

  const embed = new EmbedBuilder()
    .setTitle('🚗 Neue Lobby wird erstellt')
    .setColor(0x2ecc71)
    .setThumbnail('https://cdn.discordapp.com/attachments/1263943643346239619/1387888063807492267/image.png')
    .addFields(
      { name: '📍 Map', value: map, inline: true },
      { name: '🧠 Modus', value: mode, inline: true },
      { name: '🎮 Host', value: `<@${interaction.user.id}>`, inline: true }
    )
    .setFooter({ text: 'Wähle dein Team durch Klicken auf einen Button.' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('team_a')
      .setLabel('Team A 🔴')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('team_b')
      .setLabel('Team B 🔵')
      .setStyle(ButtonStyle.Primary)
  );

  // Nachricht in Channel posten
  await interaction.reply({ content: '✅ Lobby erstellt!', ephemeral: true });

  const lobbyChannel = interaction.channel;
  const msg = await lobbyChannel.send({
    content: `<@&1388296883159437382>`,
    embeds: [embed],
    components: [row]
  });

  const teamA = [interaction.user];
  const teamB = [];

  const collector = msg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 30 * 60 * 1000
  });

  collector.on('collect', async i => {
    const user = i.user;

    if (teamA.includes(user) || teamB.includes(user)) {
      return i.reply({ content: '❌ Du bist bereits in einem Team!', ephemeral: true });
    }

    if (i.customId === 'team_a' && teamA.length < 4) {
      teamA.push(user);
    } else if (i.customId === 'team_b' && teamB.length < 4) {
      teamB.push(user);
    } else {
      return i.reply({ content: '❌ Dieses Team ist voll oder ungültig.', ephemeral: true });
    }

    i.reply({ content: `✅ Du bist nun in Team ${i.customId === 'team_a' ? 'A 🔴' : 'B 🔵'}`, ephemeral: true });

    embed.setDescription(`**Team A 🔴**\n${teamA.map(u => `<@${u.id}>`).join('\n')}\n\n**Team B 🔵**\n${teamB.map(u => `<@${u.id}>`).join('\n')}`);
    await msg.edit({ embeds: [embed] });

    if (teamA.length === 4 && teamB.length === 4) {
      collector.stop();

      embed.setTitle('✅ Lobby ist voll')
        .setColor(0xf1c40f)
        .setFooter({ text: 'Ticket wird erstellt...' });
      await msg.edit({ embeds: [embed], components: [] });

      // Kategorie suchen
      const category = interaction.guild.channels.cache.find(c => c.name.toLowerCase().includes('lobby') && c.type === ChannelType.GuildCategory);
      if (!category) return msg.reply('❌ Kategorie nicht gefunden.');

      const ticket = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          ...teamA.map(u => ({
            id: u.id,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
          })),
          ...teamB.map(u => ({
            id: u.id,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
          }))
        ]
      });

      const closeBtn = new ButtonBuilder()
        .setCustomId('close_ticket')
        .setLabel('🔒 Ticket schließen')
        .setStyle(ButtonStyle.Danger);

      const closeRow = new ActionRowBuilder().addComponents(closeBtn);

      await ticket.send({
        content: `🎫 Willkommen in der Lobby <@&1388296883159437382>!\nTeam A: ${teamA.map(u => `<@${u.id}>`).join(', ')}\nTeam B: ${teamB.map(u => `<@${u.id}>`).join(', ')}\n\nVerwendet den Button unten, um das Ticket zu schließen.`,
        components: [closeRow]
      });

      const btnCollector = ticket.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60 * 60 * 1000 });

      btnCollector.on('collect', async btn => {
        if (btn.customId === 'close_ticket') {
          if (!teamA.includes(btn.user) && !teamB.includes(btn.user)) {
            return btn.reply({ content: '❌ Nur Teilnehmer dürfen das Ticket schließen.', ephemeral: true });
          }

          await btn.reply('🔒 Ticket wird geschlossen...');
          ticket.delete().catch(() => {});
        }
      });
    }
  });
});

client.login(process.env.TOKEN);
