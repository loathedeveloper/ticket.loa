// Buton işleyicileri
const { 
  ModalBuilder, 
  ActionRowBuilder, 
  TextInputBuilder, 
  TextInputStyle 
} = require('discord.js');
const ticketUtils = require('./ticketUtils');

// Buton işleyicileri
const buttonHandlers = [
  // Ticket oluşturma butonu
  {
    customId: 'create_ticket',
    async execute(interaction, client) {
      try {
        // Sunucu ayarlarını al
        const settings = client.db.getGuildSettings(interaction.guild.id);
        
        // Kullanıcının açık ticket sayısını kontrol et
        const userTickets = client.db.getUserTickets(interaction.user.id, interaction.guild.id);
        if (userTickets.length >= settings.max_tickets) {
          return await interaction.reply({
            content: `Maksimum açık ticket sayısına ulaştınız (${settings.max_tickets}). Lütfen önce mevcut ticketlarınızı kapatın.`,
            ephemeral: true
          });
        }
        
        // Neden gerekli mi kontrol et
        if (settings.require_reason) {
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
          
          await interaction.reply({
            content: 'Lütfen destek talebiniz için bir kategori seçin:',
            components: [row],
            ephemeral: true
          });
          return;
        }
        
        // Kategori yoksa direkt oluştur
        await interaction.deferReply({ ephemeral: true });
        const channel = await ticketUtils.createTicketChannel(interaction, client);
        
        await interaction.editReply({
          content: `Destek talebiniz oluşturuldu: <#${channel.id}>`,
          ephemeral: true
        });
      } catch (error) {
        console.error('Ticket oluşturma hatası:', error);
        
        if (interaction.deferred) {
          await interaction.editReply({
            content: `Hata: ${error.message}`,
            ephemeral: true
          });
        } else {
          await interaction.reply({
            content: `Hata: ${error.message}`,
            ephemeral: true
          });
        }
      }
    }
  },
  
  // Ticket kapatma butonu
  {
    customId: 'ticket_close',
    async execute(interaction, client) {
      try {
        await interaction.deferReply();
        await ticketUtils.closeTicket(interaction, client);
        
        await interaction.editReply({
          content: 'Ticket başarıyla kapatıldı.'
        });
      } catch (error) {
        console.error('Ticket kapatma hatası:', error);
        await interaction.editReply({
          content: `Hata: ${error.message}`
        });
      }
    }
  },
  
  // Ticket silme butonu
  {
    customId: 'ticket_delete',
    async execute(interaction, client) {
      try {
        await ticketUtils.deleteTicket(interaction, client);
      } catch (error) {
        console.error('Ticket silme hatası:', error);
        await interaction.reply({
          content: `Hata: ${error.message}`,
          ephemeral: true
        });
      }
    }
  },
  
  // Ticket yeniden açma butonu
  {
    customId: 'ticket_reopen',
    async execute(interaction, client) {
      try {
        await interaction.deferReply();
        await ticketUtils.reopenTicket(interaction, client);
        
        await interaction.editReply({
          content: 'Ticket başarıyla yeniden açıldı.'
        });
      } catch (error) {
        console.error('Ticket yeniden açma hatası:', error);
        await interaction.editReply({
          content: `Hata: ${error.message}`
        });
      }
    }
  },
  
  // Ticket üstlenme butonu
  {
    customId: 'ticket_claim',
    async execute(interaction, client) {
      try {
        const { channel, guild, user } = interaction;
        
        // Ticket bilgilerini al
        const ticket = client.db.getTicket(channel.id);
        if (!ticket) {
          return await interaction.reply({
            content: 'Bu kanal bir ticket kanalı değil!',
            ephemeral: true
          });
        }
        
        // Ticket zaten üstlenilmiş mi kontrol et
        if (channel.topic && channel.topic.includes(`Üstlenen: <@${user.id}>`)) {
          return await interaction.reply({
            content: 'Bu ticket zaten sizin tarafınızdan üstlenilmiş!',
            ephemeral: true
          });
        }
        
        // Kanalın konusunu güncelle
        const currentTopic = channel.topic || '';
        const newTopic = currentTopic.includes('Üstlenen:')
          ? currentTopic.replace(/Üstlenen: <@\d+>/, `Üstlenen: <@${user.id}>`)
          : `${currentTopic} | Üstlenen: <@${user.id}>`;
        
        await channel.setTopic(newTopic);
        
        // Üstlenme mesajı gönder
        await interaction.reply({
          content: `Bu ticket <@${user.id}> tarafından üstlenildi.`
        });
        
        // Log kanalına bildirim gönder
        const settings = client.db.getGuildSettings(guild.id);
        if (settings.log_channel_id) {
          const logChannel = await guild.channels.fetch(settings.log_channel_id).catch(() => null);
          
          if (logChannel) {
            await logChannel.send({
              content: `📋 <#${channel.id}> ticket'ı <@${user.id}> tarafından üstlenildi.`
            });
          }
        }
      } catch (error) {
        console.error('Ticket üstlenme hatası:', error);
        await interaction.reply({
          content: `Hata: ${error.message}`,
          ephemeral: true
        });
      }
    }
  },
  
  // Ticket döküm alma butonu
  {
    customId: 'ticket_transcript',
    async execute(interaction, client) {
      try {
        const { channel, guild, user } = interaction;
        
        // Ticket bilgilerini al
        const ticket = client.db.getTicket(channel.id);
        if (!ticket) {
          return await interaction.reply({
            content: 'Bu kanal bir ticket kanalı değil!',
            ephemeral: true
          });
        }
        
        await interaction.deferReply();
        
        // Mesajları al
        const messages = await channel.messages.fetch({ limit: 100 });
        
        // Döküm oluştur
        let transcript = `# Ticket Dökümü\n`;
        transcript += `**Ticket ID:** ${ticket.id}\n`;
        transcript += `**Kanal:** ${channel.name}\n`;
        transcript += `**Oluşturan:** <@${ticket.user_id}>\n`;
        transcript += `**Kategori:** ${ticket.category}\n`;
        transcript += `**Oluşturulma Tarihi:** ${new Date(ticket.created_at).toLocaleString('tr-TR')}\n\n`;
        transcript += `## Mesajlar\n\n`;
        
        // Mesajları ekle (en eskiden en yeniye)
        const sortedMessages = Array.from(messages.values()).reverse();
        
        for (const msg of sortedMessages) {
          const time = new Date(msg.createdTimestamp).toLocaleString('tr-TR');
          transcript += `**${msg.author.tag}** (${time}):\n`;
          
          // Mesaj içeriği
          if (msg.content) {
            transcript += `${msg.content}\n`;
          }
          
          // Embed'ler
          if (msg.embeds.length > 0) {
            transcript += `[Embed Mesajı]\n`;
          }
          
          // Ekler
          if (msg.attachments.size > 0) {
            transcript += `[Dosya Ekleri: ${msg.attachments.size}]\n`;
            
            msg.attachments.forEach(attachment => {
              transcript += `- ${attachment.name}: ${attachment.url}\n`;
            });
          }
          
          transcript += `\n`;
        }
        
        // Döküm dosyasını oluştur
        const fs = require('fs');
        const path = require('path');
        
        const transcriptDir = path.join(__dirname, '..', '..', 'transcripts');
        if (!fs.existsSync(transcriptDir)) {
          fs.mkdirSync(transcriptDir, { recursive: true });
        }
        
        const fileName = `ticket-${ticket.id}-${Date.now()}.md`;
        const filePath = path.join(transcriptDir, fileName);
        
        fs.writeFileSync(filePath, transcript);
        
        // Dosyayı gönder
        await interaction.editReply({
          content: `Ticket dökümü oluşturuldu.`,
          files: [{
            attachment: filePath,
            name: fileName
          }]
        });
        
        // Veritabanında döküm yolunu güncelle
        if (ticket.status === 'kapalı') {
          const stmt = client.db.db.prepare(`
            UPDATE tickets
            SET transcript = ?
            WHERE channel_id = ?
          `);
          stmt.run(fileName, channel.id);
        }
        
        // Log kanalına bildirim gönder
        const settings = client.db.getGuildSettings(guild.id);
        if (settings.log_channel_id) {
          const logChannel = await guild.channels.fetch(settings.log_channel_id).catch(() => null);
          
          if (logChannel) {
            await logChannel.send({
              content: `📝 <@${user.id}> kullanıcısı <#${channel.id}> ticket'ının dökümünü aldı.`,
              files: [{
                attachment: filePath,
                name: fileName
              }]
            });
          }
        }
      } catch (error) {
        console.error('Ticket döküm alma hatası:', error);
        
        if (interaction.deferred) {
          await interaction.editReply({
            content: `Hata: ${error.message}`
          });
        } else {
          await interaction.reply({
            content: `Hata: ${error.message}`,
            ephemeral: true
          });
        }
      }
    }
  }
];

module.exports = buttonHandlers; 