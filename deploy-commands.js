const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const commands = [
  new SlashCommandBuilder()
    .setName('lobby')
    .setDescription('Erstellt eine Spiel-Lobby')
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
        .setDescription('Teamgröße pro Seite')
        .setRequired(true)
        .addChoices(
          { name: '4', value: '4' },
          { name: '6', value: '6' }
        ))
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log('⏳ Registering commands...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log('✅ Slash-Commands erfolgreich registriert!');
  } catch (error) {
    console.error('❌ Fehler beim Registrieren:', error);
  }
})();
