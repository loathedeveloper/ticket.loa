// Seçim menüsü işleyicileri
const ticketUtils = require('./ticketUtils');

// Seçim menüsü işleyicileri
const selectMenuHandlers = [
  // Ticket kategorisi seçim menüsü
  {
    customId: 'ticket_category_select',
    async execute(interaction, client) {
      try {
        await interaction.deferUpdate();
        
        // Seçilen kategoriyi al
        const category = interaction.values[0];
        
        // Nedeni al (eğer varsa)
        let reason = 'Belirtilmedi';
        if (client.ticketReasons && client.ticketReasons.has(interaction.user.id)) {
          reason = client.ticketReasons.get(interaction.user.id);
          client.ticketReasons.delete(interaction.user.id);
        }
        
        // Ticket oluştur
        const channel = await ticketUtils.createTicketChannel(interaction, client, category, reason);
        
        await interaction.editReply({
          content: `Destek talebiniz oluşturuldu: <#${channel.id}>`,
          components: []
        });
      } catch (error) {
        console.error('Ticket oluşturma hatası:', error);
        await interaction.editReply({
          content: `Hata: ${error.message}`,
          components: []
        });
      }
    }
  },
  
  // Kategori silme seçim menüsü
  {
    customId: 'delete_category_select',
    async execute(interaction, client) {
      try {
        await interaction.deferUpdate();
        
        // Seçilen kategori ID'sini al
        const categoryId = interaction.values[0];
        
        // Kategoriyi veritabanından sil
        const stmt = client.db.db.prepare(`
          DELETE FROM ticket_categories
          WHERE id = ?
        `);
        stmt.run(categoryId);
        
        await interaction.editReply({
          content: 'Kategori başarıyla silindi.',
          components: []
        });
      } catch (error) {
        console.error('Kategori silme hatası:', error);
        await interaction.editReply({
          content: `Hata: ${error.message}`,
          components: []
        });
      }
    }
  }
];

module.exports = selectMenuHandlers; 