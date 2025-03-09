// Ticket işlemleri için yardımcı fonksiyonlar
const { 
  ChannelType, 
  PermissionFlagsBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} = require('discord.js');

async function createTicketChannel(interaction, client, category = 'genel', reason = 'Belirtilmedi') {
  const { guild, user } = interaction;
  
  // Sunucu ayarlarını al
  const settings = client.db.getGuildSettings(guild.id);
  
  // Kullanıcının açık ticket sayısını kontrol et
  const userTickets = client.db.getUserTickets(user.id, guild.id);
  if (userTickets.length >= settings.max_tickets) {
    throw new Error(`Maksimum açık ticket sayısına ulaştınız (${settings.max_tickets}). Lütfen önce mevcut ticketlarınızı kapatın.`);
  }
  
  // Kategori bilgilerini al - Kategori ID ve destek rolü ID kullanımını kaldırıyoruz
  let categoryData = null;
  
  if (category !== 'genel') {
    const categories = client.db.getTicketCategories(guild.id);
    categoryData = categories.find(c => c.name.toLowerCase() === category.toLowerCase());
  }
  
  // Kanal izinleri
  const channelPermissions = [
    {
      id: guild.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
    {
      id: user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    }
  ];
  
  if (settings.support_role_id) {
    channelPermissions.push({
      id: settings.support_role_id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    });
  }
  
  const ticketCount = settings.ticket_count + 1;
  
  const channelName = `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}-${ticketCount}`;
  
  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    permissionOverwrites: channelPermissions,
    topic: `Ticket ${ticketCount} | Kullanıcı: ${user.tag} | ID: ${user.id} | Kategori: ${category} | Neden: ${reason}`,
  });
  
  const ticketId = client.db.createTicket(channel.id, user.id, guild.id, category);
  
  const welcomeEmbed = new EmbedBuilder()
    .setColor('#3498db')
    .setTitle(`Ticket #${ticketCount}`)
    .setDescription(settings.welcome_message || `Merhaba ${user}, destek talebiniz oluşturuldu. Lütfen sorununuzu detaylı bir şekilde açıklayın. Ekibimiz en kısa sürede size yardımcı olacaktır.`)
    .addFields(
      { name: 'Kategori', value: category, inline: true },
      { name: 'Oluşturan', value: `<@${user.id}>`, inline: true },
      { name: 'Neden', value: reason, inline: true }
    )
    .setFooter({ text: `Ticket ID: ${ticketId}` })
    .setTimestamp();
  
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_close')
        .setLabel('Kapat')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔒'),
      new ButtonBuilder()
        .setCustomId('ticket_claim')
        .setLabel('Üstlen')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✋'),
      new ButtonBuilder()
        .setCustomId('ticket_transcript')
        .setLabel('Döküm Al')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📝')
    );
  
  await channel.send({ 
    content: `<@${user.id}> ${settings.support_role_id ? `<@&${settings.support_role_id}>` : ''}`,
    embeds: [welcomeEmbed],
    components: [row]
  });
  
  if (settings.log_channel_id) {
    const logChannel = await guild.channels.fetch(settings.log_channel_id).catch(() => null);
    
    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('Yeni Ticket Oluşturuldu')
        .addFields(
          { name: 'Ticket', value: `<#${channel.id}>`, inline: true },
          { name: 'Kullanıcı', value: `<@${user.id}>`, inline: true },
          { name: 'Kategori', value: category, inline: true },
          { name: 'Neden', value: reason, inline: false }
        )
        .setFooter({ text: `Ticket ID: ${ticketId}` })
        .setTimestamp();
      
      await logChannel.send({ embeds: [logEmbed] });
    }
  }
  
  return channel;
}

async function closeTicket(interaction, client) {
  const { channel, guild, user } = interaction;
  const ticket = client.db.getTicket(channel.id);
  if (!ticket) {
    throw new Error('Bu kanal bir ticket kanalı değil!');
  }
  
  if (ticket.status === 'kapalı') {
    throw new Error('Bu ticket zaten kapalı!');
  }
  
  await channel.permissionOverwrites.edit(ticket.user_id, {
    ViewChannel: false,
    SendMessages: false,
  });
  
  client.db.closeTicket(channel.id);
  
  const closedEmbed = new EmbedBuilder()
    .setColor('#e74c3c')
    .setTitle('Ticket Kapatıldı')
    .setDescription(`Bu ticket <@${user.id}> tarafından kapatıldı.`)
    .setFooter({ text: `Ticket ID: ${ticket.id}` })
    .setTimestamp();
  
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_delete')
        .setLabel('Sil')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️'),
      new ButtonBuilder()
        .setCustomId('ticket_reopen')
        .setLabel('Yeniden Aç')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🔓'),
      new ButtonBuilder()
        .setCustomId('ticket_transcript')
        .setLabel('Döküm Al')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📝')
    );
  
  await channel.send({ embeds: [closedEmbed], components: [row] });
  
  const settings = client.db.getGuildSettings(guild.id);
  if (settings.log_channel_id) {
    const logChannel = await guild.channels.fetch(settings.log_channel_id).catch(() => null);
    
    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setColor('#e74c3c')
        .setTitle('Ticket Kapatıldı')
        .addFields(
          { name: 'Ticket', value: `<#${channel.id}>`, inline: true },
          { name: 'Kapatan', value: `<@${user.id}>`, inline: true },
          { name: 'Oluşturan', value: `<@${ticket.user_id}>`, inline: true }
        )
        .setFooter({ text: `Ticket ID: ${ticket.id}` })
        .setTimestamp();
      
      await logChannel.send({ embeds: [logEmbed] });
    }
  }
  
  return true;
}

async function reopenTicket(interaction, client) {
  const { channel, guild, user } = interaction;
  
  const ticket = client.db.getTicket(channel.id);
  if (!ticket) {
    throw new Error('Bu kanal bir ticket kanalı değil!');
  }
  
  if (ticket.status === 'açık') {
    throw new Error('Bu ticket zaten açık!');
  }
  
  await channel.permissionOverwrites.edit(ticket.user_id, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
  });
  
  const stmt = client.db.db.prepare(`
    UPDATE tickets
    SET status = 'açık', closed_at = NULL
    WHERE channel_id = ?
  `);
  stmt.run(channel.id);
  
  const reopenEmbed = new EmbedBuilder()
    .setColor('#2ecc71')
    .setTitle('Ticket Yeniden Açıldı')
    .setDescription(`Bu ticket <@${user.id}> tarafından yeniden açıldı.`)
    .setFooter({ text: `Ticket ID: ${ticket.id}` })
    .setTimestamp();
  
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_close')
        .setLabel('Kapat')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔒'),
      new ButtonBuilder()
        .setCustomId('ticket_claim')
        .setLabel('Üstlen')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✋'),
      new ButtonBuilder()
        .setCustomId('ticket_transcript')
        .setLabel('Döküm Al')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📝')
    );
  
  await channel.send({ 
    content: `<@${ticket.user_id}>`,
    embeds: [reopenEmbed], 
    components: [row] 
  });
  
  const settings = client.db.getGuildSettings(guild.id);
  if (settings.log_channel_id) {
    const logChannel = await guild.channels.fetch(settings.log_channel_id).catch(() => null);
    
    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('Ticket Yeniden Açıldı')
        .addFields(
          { name: 'Ticket', value: `<#${channel.id}>`, inline: true },
          { name: 'Açan', value: `<@${user.id}>`, inline: true },
          { name: 'Oluşturan', value: `<@${ticket.user_id}>`, inline: true }
        )
        .setFooter({ text: `Ticket ID: ${ticket.id}` })
        .setTimestamp();
      
      await logChannel.send({ embeds: [logEmbed] });
    }
  }
  
  return true;
}

async function deleteTicket(interaction, client) {
  const { channel, guild, user } = interaction;
  
  const ticket = client.db.getTicket(channel.id);
  if (!ticket) {
    throw new Error('Bu kanal bir ticket kanalı değil!');
  }
  
  await interaction.reply({
    content: 'Bu ticket 5 saniye içinde silinecek...',
    ephemeral: false
  });
  
  const settings = client.db.getGuildSettings(guild.id);
  if (settings.log_channel_id) {
    const logChannel = await guild.channels.fetch(settings.log_channel_id).catch(() => null);
    
    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setColor('#e74c3c')
        .setTitle('Ticket Silindi')
        .addFields(
          { name: 'Ticket', value: `#${channel.name}`, inline: true },
          { name: 'Silen', value: `<@${user.id}>`, inline: true },
          { name: 'Oluşturan', value: `<@${ticket.user_id}>`, inline: true }
        )
        .setFooter({ text: `Ticket ID: ${ticket.id}` })
        .setTimestamp();
      
      await logChannel.send({ embeds: [logEmbed] });
    }
  }
  
  client.db.deleteTicket(channel.id);
  
  setTimeout(async () => {
    await channel.delete().catch(console.error);
  }, 5000);
  
  return true;
}

function createCategorySelect(guild, client) {
  const categories = client.db.getTicketCategories(guild.id);
  
  const options = [
    new StringSelectMenuOptionBuilder()
      .setLabel('Genel')
      .setDescription('Genel destek talebi')
      .setValue('genel')
      .setEmoji('🎫')
  ];

  for (const category of categories) {
    options.push(
      new StringSelectMenuOptionBuilder()
        .setLabel(category.name)
        .setDescription(category.description || `${category.name} kategorisi`)
        .setValue(category.name.toLowerCase())
        .setEmoji(category.emoji || '🎫')
    );
  }
  
  const select = new StringSelectMenuBuilder()
    .setCustomId('ticket_category_select')
    .setPlaceholder('Ticket kategorisi seçin')
    .addOptions(options);
  
  return new ActionRowBuilder().addComponents(select);
}

async function sendTicketPanel(interaction, client, channelId = null) {
  const { guild } = interaction;
  
  let targetChannel;
  if (channelId) {
    targetChannel = await guild.channels.fetch(channelId).catch(() => null);
    if (!targetChannel) {
      throw new Error('Belirtilen kanal bulunamadı!');
    }
  } else {
    targetChannel = interaction.channel;
  }
  
  const settings = client.db.getGuildSettings(guild.id);
  
  const panelEmbed = new EmbedBuilder()
    .setColor('#3498db')
    .setTitle('Destek Talebi Oluştur')
    .setDescription(settings.panel_message || 'Destek talebi oluşturmak için aşağıdaki butona tıklayın. Ekibimiz en kısa sürede size yardımcı olacaktır.')
    .setFooter({ text: guild.name, iconURL: guild.iconURL({ dynamic: true }) });
  
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('create_ticket')
        .setLabel('Destek Talebi Oluştur')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎫')
    );
  
  return await targetChannel.send({ embeds: [panelEmbed], components: [row] });
}

module.exports = {
  createTicketChannel,
  closeTicket,
  reopenTicket,
  deleteTicket,
  createCategorySelect,
  sendTicketPanel
}; 