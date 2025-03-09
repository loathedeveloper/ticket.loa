// Global komutları silmek için script
require('dotenv').config();
const { REST, Routes } = require('discord.js');

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log('Global komutları silme işlemi başlatılıyor...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: [] },
    );
    
    console.log('Global komutlar başarıyla silindi!');
  } catch (error) {
    console.error('Global komutları silerken hata oluştu:', error);
  }
})(); 