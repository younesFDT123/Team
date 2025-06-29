const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const commands = [
  new SlashCommandBuilder()
    .setName('lobbyv2')
    .setDescription('Erstellt eine neue Spiel-Lobby mit Teamsystem')
    .addStringOption(option =>
      option.setName('modus')
        .setDescription('Wähle den Modus')
        .setRequired(true)
        .addChoices(
          { name: '4vs4', value: '4vs4' },
          { name: '6vs6', value: '6vs6' }
        ))
    .addStringOption(option =>
      option.setName('map')
        .setDescription('Wähle eine Map')
        .setRequired(true)
        .addChoices(
          { name: 'Sandy Shores', value: 'Sandy Shores' },
          { name: 'Mirror Park', value: 'Mirror Park' }
        ))
    .addStringOption(option =>
      option.setName('team')
        .setDescription('Teamgröße')
        .setRequired(true)
        .addChoices(
          { name: '3', value: '3' },
          { name: '4', value: '4' },
          { name: '5', value: '5' },
          { name: '6', value: '6' }
        ))
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log('⏳ Slash Commands werden registriert...');
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log('✅ Slash Commands erfolgreich registriert!');
  } catch (error) {
    console.error(error);
  }
})();
