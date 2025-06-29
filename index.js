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
  PermissionsBitField,
} = require('discord.js');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot läuft!');
});

app.listen(PORT, () => {
  console.log(`Webserver läuft auf Port ${PORT}`);
});

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  partials: [Partials.Channel],
});

client.once('ready', () => {
  console.log(`✅ Bot ist online als ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'lobby') {
    // ✅ Nur in bestimmtem Channel erlauben:
    const erlaubterChannel = '1388989682053812374';
    if (interaction.channelId !== erlaubterChannel) {
      return interaction.reply({
        content: '❌ Du kannst diesen Befehl nur in <#1388989682053812374> verwenden.',
        ephemeral: true,
      });
    }

    const mode = interaction.options.getString('modus');
    const map = interaction.options.getString('map');

    const embed = new EmbedBuilder()
      .setTitle(`🚗 Neue ${mode} Lobby`)
      .setColor(0x3498db)
      .setThumbnail('https://cdn.discordapp.com/attachments/1263943643346239619/1387888063807492267/image.png')
      .addFields(
        { name: '🗺️ Map', value: map, inline: true },
        { name: '🎮 Modus', value: mode, inline: true },
        { name: '📌 Host', value: `<@${interaction.user.id}>` }
      )
      .setFooter({ text: 'Wähle ein Team, um beizutreten.' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('teamA').setLabel('🚗 Team A').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('teamB').setLabel('🚙 Team B').setStyle(ButtonStyle.Secondary)
    );

    const lobbyChannel = interaction.channel;
    const msg = await lobbyChannel.send({ embeds: [embed], components: [row] });

    const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30 * 60 * 1000 });

    const teamSize = mode === '4vs4' ? 4 : 6;
    const teamA = [];
    const teamB = [];

    collector.on('collect', async i => {
      const userId = i.user.id;
      if (teamA.includes(userId) || teamB.includes(userId)) {
        return i.reply({ content: '❌ Du bist bereits einem Team beigetreten.', ephemeral: true });
      }

      if (i.customId === 'teamA' && teamA.length < teamSize) {
        teamA.push(userId);
        await i.reply({ content: '✅ Du bist Team A beigetreten.', ephemeral: true });
      } else if (i.customId === 'teamB' && teamB.length < teamSize) {
        teamB.push(userId);
        await i.reply({ content: '✅ Du bist Team B beigetreten.', ephemeral: true });
      } else {
        await i.reply({ content: '❌ Dieses Team ist voll.', ephemeral: true });
      }

      embed.data.fields = [
        { name: '🗺️ Map', value: map, inline: true },
        { name: '🎮 Modus', value: mode, inline: true },
        { name: '📌 Host', value: `<@${interaction.user.id}>` },
        { name: '🚗 Team A', value: teamA.map(id => `<@${id}>`).join('\n') || '—', inline: true },
        { name: '🚙 Team B', value: teamB.map(id => `<@${id}>`).join('\n') || '—', inline: true },
      ];

      await msg.edit({ embeds: [embed] });

      if (teamA.length === teamSize && teamB.length === teamSize) {
        collector.stop('voll');
      }
    });

    collector.on('end', async (_, reason) => {
      if (reason === 'voll') {
        const category = interaction.guild.channels.cache.find(
          c => c.name.toLowerCase() === 'lobby suche' && c.type === ChannelType.GuildCategory
        );

        const ticketChannel = await interaction.guild.channels.create({
          name: `match-${Date.now()}`,
          type: ChannelType.GuildText,
          parent: category?.id,
          permissionOverwrites: [
            { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            ...[...teamA, ...teamB].map(id => ({
              id,
              allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
            })),
          ],
        });

        const closeBtn = new ButtonBuilder()
          .setCustomId('close_ticket')
          .setLabel('🔒 Ticket schließen')
          .setStyle(ButtonStyle.Danger);

        const closeRow = new ActionRowBuilder().addComponents(closeBtn);

        await ticketChannel.send({
          content: `Willkommen zum Match!\nTeam A: ${teamA.map(id => `<@${id}>`).join(', ')}\nTeam B: ${teamB.map(id => `<@${id}>`).join(', ')}`,
          components: [closeRow],
        });

        const closeCollector = ticketChannel.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60 * 60 * 1000 });

        closeCollector.on('collect', async btn => {
          if (btn.customId === 'close_ticket') {
            await btn.reply('🔒 Ticket wird geschlossen...');
            ticketChannel.delete().catch(() => {});
          }
        });
      }
    });
  }
});

client.login(process.env.TOKEN);
