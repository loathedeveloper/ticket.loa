// Ticket komutu
const { 
  SlashCommandBuilder, 
  PermissionFlagsBits,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder
} = require('discord.js');
const ticketUtils = require('../utils/ticketUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket sistemi komutları')
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages) // Temel izin
    .addSubcommand(subcommand =>
      subcommand
        .setName('oluştur')
        .setDescription('Yeni bir destek talebi oluşturur')
        .addStringOption(option =>
          option
            .setName('neden')
            .setDescription('Destek talebinizin nedeni')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('kapat')
        .setDescription('Mevcut destek talebini kapatır')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('panel')
        .setDescription('Ticket oluşturma paneli gönderir')
        .addChannelOption(option =>
          option
            .setName('kanal')
            .setDescription('Panelin gönderileceği kanal')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('ayarla')
        .setDescription('Ticket sistemi ayarlarını yapılandırır')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('kategori')
        .setDescription('Ticket kategorilerini yönetir')
        .addStringOption(option =>
          option
            .setName('işlem')
            .setDescription('Yapılacak işlem')
            .setRequired(true)
            .addChoices(
              { name: 'Ekle', value: 'ekle' },
              { name: 'Listele', value: 'listele' },
              { name: 'Sil', value: 'sil' }
            )
        )
    ),
    
  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    
    // Yetki kontrolü
    if (subcommand === 'panel' || subcommand === 'ayarla' || subcommand === 'kategori') {
      // Panel, ayarla ve kategori komutları için yönetici yetkisi gerekli
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return await interaction.reply({
          content: 'Bu komutu kullanmak için "Kanalları Yönet" yetkisine sahip olmalısınız!',
          ephemeral: true
        });
      }
      
      // Kategori ve ayarla komutları için ek olarak yönetici yetkisi gerekli
      if ((subcommand === 'ayarla' || subcommand === 'kategori') && 
          !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return await interaction.reply({
          content: 'Bu komutu kullanmak için "Yönetici" yetkisine sahip olmalısınız!',
          ephemeral: true
        });
      }
    }
    
    // Ticket oluştur
    if (subcommand === 'oluştur') {
      await interaction.deferReply({ ephemeral: true });
      
      try {
        // Sunucu ayarlarını al
        const settings = client.db.getGuildSettings(interaction.guild.id);
        
        // Neden gerekli mi kontrol et
        if (settings.require_reason && !interaction.options.getString('neden')) {
          // Modal oluştur
          const modal = new ModalBuilder()
            .setCustomId('ticket_create_modal')
            .setTitle('Destek Talebi Oluştur');
          
          // Neden giriş alanı
          const reasonInput = new TextInputBuilder()
            .setCustomId('ticket_reason')
            .setLabel('Destek talebinizin nedeni nedir?')
            .setPlaceholder('Lütfen sorununuzu kısaca açıklayın...')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMinLength(10)
            .setMaxLength(1000);
          
          // Modal'a ekle
          modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
          
          // Modal'ı göster
          await interaction.showModal(modal);
          return;
        }
        
        // Kategori seçimi için
        const categories = client.db.getTicketCategories(interaction.guild.id);
        if (categories.length > 0) {
          // Kategori seçim menüsü gönder
          const row = ticketUtils.createCategorySelect(interaction.guild, client);
          
          await interaction.editReply({
            content: 'Lütfen destek talebiniz için bir kategori seçin:',
            components: [row],
            ephemeral: true
          });
          return;
        }
        
        // Kategori yoksa direkt oluştur
        const reason = interaction.options.getString('neden') || 'Belirtilmedi';
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
    
    // Ticket kapat
    else if (subcommand === 'kapat') {
      try {
        // Ticket kanalında mı kontrol et
        const ticket = client.db.getTicket(interaction.channel.id);
        if (!ticket) {
          return await interaction.reply({
            content: 'Bu komut sadece ticket kanallarında kullanılabilir!',
            ephemeral: true
          });
        }
        
        await interaction.deferReply();
        await ticketUtils.closeTicket(interaction, client);
        
        await interaction.editReply({
          content: 'Ticket başarıyla kapatıldı.'
        });
      } catch (error) {
        console.error('Ticket kapatma hatası:', error);
        await interaction.reply({
          content: `Hata: ${error.message}`,
          ephemeral: true
        });
      }
    }
    
    // Ticket panel
    else if (subcommand === 'panel') {
      await interaction.deferReply({ ephemeral: true });
      
      try {
        const channel = interaction.options.getChannel('kanal') || interaction.channel;
        
        await ticketUtils.sendTicketPanel(interaction, client, channel.id);
        
        await interaction.editReply({
          content: `Ticket paneli ${channel} kanalına gönderildi.`,
          ephemeral: true
        });
      } catch (error) {
        console.error('Panel gönderme hatası:', error);
        await interaction.editReply({
          content: `Hata: ${error.message}`,
          ephemeral: true
        });
      }
    }
    
    // Ticket ayarları
    else if (subcommand === 'ayarla') {
      // Ayarlar modalını göster
      const modal = new ModalBuilder()
        .setCustomId('ticket_settings_modal')
        .setTitle('Ticket Sistemi Ayarları');
      
      // Mevcut ayarları al
      const settings = client.db.getGuildSettings(interaction.guild.id);
      
      // Destek rolü giriş alanı
      const supportRoleInput = new TextInputBuilder()
        .setCustomId('support_role_id')
        .setLabel('Destek Rolü ID')
        .setPlaceholder('Destek ekibi rolünün ID\'sini girin')
        .setValue(settings.support_role_id || '')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);
      
      // Kategori ID giriş alanı
      const categoryInput = new TextInputBuilder()
        .setCustomId('category_id')
        .setLabel('Kategori ID')
        .setPlaceholder('Ticketların oluşturulacağı kategori ID\'si')
        .setValue(settings.category_id || '')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);
      
      // Log kanalı giriş alanı
      const logChannelInput = new TextInputBuilder()
        .setCustomId('log_channel_id')
        .setLabel('Log Kanalı ID')
        .setPlaceholder('Log mesajlarının gönderileceği kanal ID\'si')
        .setValue(settings.log_channel_id || '')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);
      
      // Hoş geldin mesajı giriş alanı
      const welcomeMessageInput = new TextInputBuilder()
        .setCustomId('welcome_message')
        .setLabel('Hoş Geldin Mesajı')
        .setPlaceholder('Ticket açıldığında gönderilecek mesaj')
        .setValue(settings.welcome_message || '')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false);
      
      // Maksimum ticket sayısı giriş alanı
      const maxTicketsInput = new TextInputBuilder()
        .setCustomId('max_tickets')
        .setLabel('Maksimum Ticket Sayısı')
        .setPlaceholder('Bir kullanıcının aynı anda açabileceği maksimum ticket sayısı')
        .setValue(settings.max_tickets?.toString() || '5')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);
      
      // Modal'a ekle
      modal.addComponents(
        new ActionRowBuilder().addComponents(supportRoleInput),
        new ActionRowBuilder().addComponents(categoryInput),
        new ActionRowBuilder().addComponents(logChannelInput),
        new ActionRowBuilder().addComponents(welcomeMessageInput),
        new ActionRowBuilder().addComponents(maxTicketsInput)
      );
      
      // Modal'ı göster
      await interaction.showModal(modal);
    }
    
    // Ticket kategorileri
    else if (subcommand === 'kategori') {
      const işlem = interaction.options.getString('işlem');
      
      // Kategori listele
      if (işlem === 'listele') {
        await interaction.deferReply({ ephemeral: true });
        
        const categories = client.db.getTicketCategories(interaction.guild.id);
        
        if (categories.length === 0) {
          return await interaction.editReply({
            content: 'Henüz hiç ticket kategorisi oluşturulmamış.',
            ephemeral: true
          });
        }
        
        let message = '**Ticket Kategorileri:**\n\n';
        
        for (const category of categories) {
          message += `**${category.name}** ${category.emoji || '🎫'}\n`;
          message += `Açıklama: ${category.description || 'Belirtilmemiş'}\n`;
          message += `Destek Rolü: ${category.support_role_id ? `<@&${category.support_role_id}>` : 'Varsayılan'}\n`;
          message += `Kategori: ${category.category_id ? `<#${category.category_id}>` : 'Varsayılan'}\n\n`;
        }
        
        await interaction.editReply({
          content: message,
          ephemeral: true
        });
      }
      
      // Kategori ekle
      else if (işlem === 'ekle') {
        // Kategori ekleme modalını göster
        const modal = new ModalBuilder()
          .setCustomId('ticket_category_modal')
          .setTitle('Ticket Kategorisi Ekle');
        
        // Kategori adı giriş alanı
        const nameInput = new TextInputBuilder()
          .setCustomId('category_name')
          .setLabel('Kategori Adı')
          .setPlaceholder('Örn: Teknik Destek')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        
        // Kategori açıklaması giriş alanı
        const descriptionInput = new TextInputBuilder()
          .setCustomId('category_description')
          .setLabel('Açıklama')
          .setPlaceholder('Bu kategori hakkında kısa bir açıklama')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false);
        
        // Emoji giriş alanı
        const emojiInput = new TextInputBuilder()
          .setCustomId('category_emoji')
          .setLabel('Emoji')
          .setPlaceholder('Örn: 🔧')
          .setStyle(TextInputStyle.Short)
          .setRequired(false);
        
        // Modal'a ekle
        modal.addComponents(
          new ActionRowBuilder().addComponents(nameInput),
          new ActionRowBuilder().addComponents(descriptionInput),
          new ActionRowBuilder().addComponents(emojiInput)
        );
        
        // Modal'ı göster
        await interaction.showModal(modal);
      }
      
      // Kategori sil
      else if (işlem === 'sil') {
        await interaction.deferReply({ ephemeral: true });
        
        const categories = client.db.getTicketCategories(interaction.guild.id);
        
        if (categories.length === 0) {
          return await interaction.editReply({
            content: 'Silinecek kategori bulunamadı.',
            ephemeral: true
          });
        }
        
        // Seçenekleri oluştur
        const options = categories.map(category => ({
          label: category.name,
          description: category.description?.substring(0, 50) || `${category.name} kategorisi`,
          value: category.id.toString(),
          emoji: category.emoji || '🎫'
        }));
        
        // Seçim menüsünü oluştur
        const row = new ActionRowBuilder()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('delete_category_select')
              .setPlaceholder('Silinecek kategoriyi seçin')
              .addOptions(options)
          );
        
        await interaction.editReply({
          content: 'Lütfen silmek istediğiniz kategoriyi seçin:',
          components: [row],
          ephemeral: true
        });
      }
    }
  },
}; 