// Bot hazır olduğunda çalışacak olay
module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    console.log(`${client.user.tag} olarak giriş yapıldı!`);
    
    // Bot durumunu ayarla
    client.user.setPresence({
      activities: [{ name: 'Ticket sistemi hazır!', type: 2 }],
      status: 'idle',
    });
    
    if (process.env.NODE_ENV === 'development') {
      const { REST, Routes } = require('discord.js');
      const fs = require('fs');
      const path = require('path');
      
      const commands = [];
      const commandsPath = path.join(__dirname, '..', 'commands');
      const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
      
      for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        
        if ('data' in command) {
          commands.push(command.data.toJSON());
        }
      }
      
      const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
      
      (async () => {
        try {
          console.log(`${commands.length} uygulama komutu yükleniyor...`);
          
          // Sunucu komutlarını güncelle
          if (process.env.GUILD_ID) {
            await rest.put(
              Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
              { body: commands },
            );
          } else {
            // Global komutları güncelle
            await rest.put(
              Routes.applicationCommands(process.env.CLIENT_ID),
              { body: commands },
            );
          }
        } catch (error) {
          console.error('Komutları yüklerken hata oluştu:', error);
        }
      })();
    }
  },
}; 