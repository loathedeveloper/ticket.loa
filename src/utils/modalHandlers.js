// Modal işleyicileri
const ticketUtils = require('./ticketUtils');

// Modal işleyicileri
const modalHandlers = [
  // Ticket oluşturma modalı
  {
    customId: 'ticket_create_modal',
    async execute(interaction, client) {
      try {
        await interaction.deferReply({ ephemeral: true });
        
        // Modal'dan nedeni al
        const reason = interaction.fields.getTextInputValue('ticket_reason');
        
        // Kategori seçimi için
        const categories = client.db.getTicketCategories(interaction.guild.id);
        if (categories.length > 0) {
          // Kategori seçim menüsü gönder
          const row = ticketUtils.createCategorySelect(interaction.guild, client);
          
          // Nedeni geçici olarak sakla
          client.ticketReasons = client.ticketReasons || new Map();
          client.ticketReasons.set(interaction.user.id, reason);
          
          await interaction.editReply({
            content: 'Lütfen destek talebiniz için bir kategori seçin:',
            components: [row],
            ephemeral: true
          });
          return;
        }
        
        // Kategori yoksa direkt oluştur
        const channel = await ticketUtils.createTicketChannel(interaction, client, 'genel', reason);
        
        await interaction.editReply({
          content: `Destek talebiniz oluşturuldu: <#${channel.id}>`,
          ephemeral: true
        });
      } catch (error) {
        console.error('Ticket oluşturma hatası:', error);
        await interaction.editReply({
          content: `Hata: ${error.message}`,
          ephemeral: true
        });
      }
    }
  },
  
  // Ticket ayarları modalı
  {
    customId: 'ticket_settings_modal',
    async execute(interaction, client) {
      try {
        await interaction.deferReply({ ephemeral: true });
        
        // Modal'dan değerleri al
        const supportRoleId = interaction.fields.getTextInputValue('support_role_id');
        const categoryId = interaction.fields.getTextInputValue('category_id');
        const logChannelId = interaction.fields.getTextInputValue('log_channel_id');
        const welcomeMessage = interaction.fields.getTextInputValue('welcome_message');
        const maxTickets = interaction.fields.getTextInputValue('max_tickets');
        
        // Ayarları güncelle
        const settings = {
          support_role_id: supportRoleId || null,
          category_id: categoryId || null,
          log_channel_id: logChannelId || null,
          welcome_message: welcomeMessage || null,
          max_tickets: parseInt(maxTickets) || 5
        };
        
        client.db.updateGuildSettings(interaction.guild.id, settings);
        
        // Başarı mesajı gönder
        await interaction.editReply({
          content: 'Ticket sistemi ayarları başarıyla güncellendi.',
          ephemeral: true
        });
      } catch (error) {
        console.error('Ayarları güncelleme hatası:', error);
        await interaction.editReply({
          content: `Hata: ${error.message}`,
          ephemeral: true
        });
      }
    }
  },
  
  // Ticket kategorisi ekleme modalı
  {
    customId: 'ticket_category_modal',
    async execute(interaction, client) {
      try {
        await interaction.deferReply({ ephemeral: true });
        
        // Modal'dan değerleri al
        const name = interaction.fields.getTextInputValue('category_name');
        const description = interaction.fields.getTextInputValue('category_description');
        const emoji = interaction.fields.getTextInputValue('category_emoji');
        
        // Kategoriyi ekle
        client.db.addTicketCategory(
          interaction.guild.id,
          name,
          description || '',
          emoji || '🎫'
        );
        
        // Başarı mesajı gönder
        await interaction.editReply({
          content: `"${name}" kategorisi başarıyla eklendi.`,
          ephemeral: true
        });
      } catch (error) {
        console.error('Kategori ekleme hatası:', error);
        await interaction.editReply({
          content: `Hata: ${error.message}`,
          ephemeral: true
        });
      }
    }
  }
];

module.exports = modalHandlers; 