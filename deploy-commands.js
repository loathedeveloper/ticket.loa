// Komutları Discord API'ye kaydetmek için script
require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const GUILD_ID = process.env.GUILD_ID;

const commands = [];
const commandsPath = path.join(__dirname, 'src', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  
  if ('data' in command) {
    commands.push(command.data.toJSON());
  } else {
    console.log(`[UYARI] ${filePath} komut dosyasında gerekli "data" özelliği eksik.`);
  }
}

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log(`${commands.length} uygulama komutu yükleniyor...`);
    
    if (GUILD_ID) {
      // Sunucu komutlarını güncelle
      console.log(`Sunucu komutları ${GUILD_ID} için yükleniyor...`);
      const data = await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, GUILD_ID),
        { body: commands },
      );
      console.log(`Sunucu komutları başarıyla yüklendi! (${data.length} komut)`);
    } else {
      console.log('Global komutlar yükleniyor...');
      const data = await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands },
      );
      console.log(`Global komutlar başarıyla yüklendi! (${data.length} komut)`);
    }
    
    console.log('Komutlar:');
    for (const cmd of commands) {
      console.log(`- /${cmd.name}`);
    }
  } catch (error) {
    console.error('Komutları yüklerken hata oluştu:', error);
  }
})(); 