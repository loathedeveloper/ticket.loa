// Etkileşimleri işleyecek olay
const buttonHandlers = require('../utils/buttonHandlers');
const modalHandlers = require('../utils/modalHandlers');
const selectMenuHandlers = require('../utils/selectMenuHandlers');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    // Buton işleyicilerini yükle
    if (!client.buttons.size) {
      for (const handler of buttonHandlers) {
        client.buttons.set(handler.customId, handler);
      }
    }
    
    // Modal işleyicilerini yükle
    if (!client.modals.size) {
      for (const handler of modalHandlers) {
        client.modals.set(handler.customId, handler);
      }
    }
    
    // Seçim menüsü işleyicilerini yükle
    if (!client.selectMenus.size) {
      for (const handler of selectMenuHandlers) {
        client.selectMenus.set(handler.customId, handler);
      }
    }
    
    // Slash komutlarını işle
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      
      if (!command) {
        console.error(`${interaction.commandName} komutu bulunamadı.`);
        return;
      }
      
      try {
        await command.execute(interaction, client);
      } catch (error) {
        console.error(`${interaction.commandName} komutunu çalıştırırken hata:`, error);
        
        const errorMessage = {
          content: 'Bu komutu çalıştırırken bir hata oluştu!',
          ephemeral: true
        };
        
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorMessage);
        } else {
          await interaction.reply(errorMessage);
        }
      }
    }
    
    // Buton etkileşimlerini işle
    else if (interaction.isButton()) {
      const button = client.buttons.get(interaction.customId) || 
                     client.buttons.find(btn => interaction.customId.startsWith(btn.customId));
      
      if (!button) return;
      
      try {
        await button.execute(interaction, client);
      } catch (error) {
        console.error(`Buton etkileşimini işlerken hata:`, error);
        await interaction.reply({
          content: 'Bu butonu işlerken bir hata oluştu!',
          ephemeral: true
        });
      }
    }
    
    // Seçim menüsü etkileşimlerini işle
    else if (interaction.isStringSelectMenu()) {
      const menu = client.selectMenus.get(interaction.customId) ||
                   client.selectMenus.find(m => interaction.customId.startsWith(m.customId));
      
      if (!menu) return;
      
      try {
        await menu.execute(interaction, client);
      } catch (error) {
        console.error(`Seçim menüsü etkileşimini işlerken hata:`, error);
        await interaction.reply({
          content: 'Bu seçim menüsünü işlerken bir hata oluştu!',
          ephemeral: true
        });
      }
    }
    
    // Modal etkileşimlerini işle
    else if (interaction.isModalSubmit()) {
      const modal = client.modals.get(interaction.customId) ||
                    client.modals.find(m => interaction.customId.startsWith(m.customId));
      
      if (!modal) return;
      
      try {
        await modal.execute(interaction, client);
      } catch (error) {
        console.error(`Modal etkileşimini işlerken hata:`, error);
        await interaction.reply({
          content: 'Bu formu işlerken bir hata oluştu!',
          ephemeral: true
        });
      }
    }
  },
}; 