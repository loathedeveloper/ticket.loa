// Veritabanı Bağlantısı
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

class TicketDatabase {
  constructor() {
    // Veritabanı dosyasının yolunu al
    this.dbPath = process.env.DB_PATH || './database.sqlite';
    
    // Veritabanı klasörünün varlığını kontrol et
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    // Veritabanı bağlantısını oluştur
    this.db = new Database(this.dbPath);
    
    // Tabloları oluştur
    this.init();
    
    console.log('Veritabanı bağlantısı başarıyla kuruldu.');
  }
  
  // Veritabanı tablolarını oluştur
  init() {
    // Ticket tablosu
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        category TEXT DEFAULT 'genel',
        status TEXT DEFAULT 'açık',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        closed_at TIMESTAMP,
        transcript TEXT
      )
    `);
    
    // Ticket ayarları tablosu
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ticket_settings (
        guild_id TEXT PRIMARY KEY,
        support_role_id TEXT,
        category_id TEXT,
        log_channel_id TEXT,
        welcome_message TEXT,
        ticket_count INTEGER DEFAULT 0,
        max_tickets INTEGER DEFAULT 5,
        require_reason BOOLEAN DEFAULT 0,
        auto_close_time INTEGER DEFAULT 0
      )
    `);
    
    // Ticket kategorileri tablosu
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ticket_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        emoji TEXT
      )
    `);
    
    // Ticket mesajları tablosu
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ticket_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES tickets (id) ON DELETE CASCADE
      )
    `);
  }
  
  // Ticket oluştur
  createTicket(channelId, userId, guildId, category = 'genel') {
    const stmt = this.db.prepare(`
      INSERT INTO tickets (channel_id, user_id, guild_id, category)
      VALUES (?, ?, ?, ?)
    `);
    
    const result = stmt.run(channelId, userId, guildId, category);
    
    // Ticket sayısını artır
    this.incrementTicketCount(guildId);
    
    return result.lastInsertRowid;
  }
  
  // Ticket'ı kapat
  closeTicket(channelId, transcript = null) {
    const stmt = this.db.prepare(`
      UPDATE tickets
      SET status = 'kapalı', closed_at = CURRENT_TIMESTAMP, transcript = ?
      WHERE channel_id = ?
    `);
    
    return stmt.run(transcript, channelId);
  }
  
  // Ticket'ı sil
  deleteTicket(channelId) {
    const stmt = this.db.prepare(`
      DELETE FROM tickets
      WHERE channel_id = ?
    `);
    
    return stmt.run(channelId);
  }
  
  // Ticket bilgilerini al
  getTicket(channelId) {
    const stmt = this.db.prepare(`
      SELECT * FROM tickets
      WHERE channel_id = ?
    `);
    
    return stmt.get(channelId);
  }
  
  // Kullanıcının açık ticket'larını al
  getUserTickets(userId, guildId) {
    const stmt = this.db.prepare(`
      SELECT * FROM tickets
      WHERE user_id = ? AND guild_id = ? AND status = 'açık'
    `);
    
    return stmt.all(userId, guildId);
  }
  
  // Sunucunun tüm ticket'larını al
  getGuildTickets(guildId, status = null) {
    let query = `
      SELECT * FROM tickets
      WHERE guild_id = ?
    `;
    
    if (status) {
      query += ` AND status = ?`;
      const stmt = this.db.prepare(query);
      return stmt.all(guildId, status);
    } else {
      const stmt = this.db.prepare(query);
      return stmt.all(guildId);
    }
  }
  
  // Ticket sayısını artır
  incrementTicketCount(guildId) {
    const stmt = this.db.prepare(`
      UPDATE ticket_settings
      SET ticket_count = ticket_count + 1
      WHERE guild_id = ?
    `);
    
    return stmt.run(guildId);
  }
  
  // Sunucu ayarlarını al
  getGuildSettings(guildId) {
    const stmt = this.db.prepare(`
      SELECT * FROM ticket_settings
      WHERE guild_id = ?
    `);
    
    return stmt.get(guildId) || this.createDefaultSettings(guildId);
  }
  
  // Varsayılan sunucu ayarlarını oluştur
  createDefaultSettings(guildId) {
    const stmt = this.db.prepare(`
      INSERT INTO ticket_settings (guild_id)
      VALUES (?)
    `);
    
    stmt.run(guildId);
    
    return this.getGuildSettings(guildId);
  }
  
  // Sunucu ayarlarını güncelle
  updateGuildSettings(guildId, settings) {
    const keys = Object.keys(settings);
    const values = Object.values(settings);
    
    if (keys.length === 0) return null;
    
    const setClause = keys.map(key => `${key} = ?`).join(', ');
    
    const stmt = this.db.prepare(`
      UPDATE ticket_settings
      SET ${setClause}
      WHERE guild_id = ?
    `);
    
    return stmt.run(...values, guildId);
  }
  
  // Ticket kategorisi ekle
  addTicketCategory(guildId, name, description = '', emoji = '🎫') {
    const stmt = this.db.prepare(`
      INSERT INTO ticket_categories (guild_id, name, description, emoji)
      VALUES (?, ?, ?, ?)
    `);
    
    return stmt.run(guildId, name, description, emoji);
  }
  
  // Ticket kategorilerini al
  getTicketCategories(guildId) {
    const stmt = this.db.prepare(`
      SELECT * FROM ticket_categories
      WHERE guild_id = ?
    `);
    
    return stmt.all(guildId);
  }
  
  // Ticket mesajı ekle
  addTicketMessage(ticketId, userId, content) {
    const stmt = this.db.prepare(`
      INSERT INTO ticket_messages (ticket_id, user_id, content)
      VALUES (?, ?, ?)
    `);
    
    return stmt.run(ticketId, userId, content);
  }
  
  // Ticket mesajlarını al
  getTicketMessages(ticketId) {
    const stmt = this.db.prepare(`
      SELECT * FROM ticket_messages
      WHERE ticket_id = ?
      ORDER BY timestamp ASC
    `);
    
    return stmt.all(ticketId);
  }
}

module.exports = TicketDatabase; 