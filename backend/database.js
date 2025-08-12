const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor() {
    this.db = null;
  }

  init() {
    return new Promise((resolve, reject) => {
      const dbPath = path.join(__dirname, 'events.db');
      this.db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          reject(err);
        } else {
          // Enable WAL journal mode for better concurrent access
          this.db.exec("PRAGMA journal_mode = WAL;", (pragmaErr) => {
            if (pragmaErr) {
              console.warn('Could not set WAL mode:', pragmaErr.message);
            }
            this.createTables()
              .then(resolve)
              .catch(reject);
          });
        }
      });
    });
  }

  createTables() {
    return new Promise((resolve, reject) => {
      const createEventsTable = `
        CREATE TABLE IF NOT EXISTS events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL,
          page_url TEXT NOT NULL,
          event_type TEXT NOT NULL,
          element_selector TEXT,
          click_x INTEGER,
          click_y INTEGER,
          scroll_depth INTEGER,
          timestamp INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      this.db.run(createEventsTable, (err) => {
        if (err) {
          console.error('Error creating events table:', err);
          reject(err);
        } else {
          console.log('Events table created successfully');
          resolve();
        }
      });
    });
  }

  insertEvents(events) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO events (session_id, page_url, event_type, element_selector, click_x, click_y, scroll_depth, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        
        events.forEach(event => {
          stmt.run([
            event.sessionId,
            event.pageUrl,
            event.eventType,
            event.elementSelector ?? null,
            event.clickX ?? null,
            event.clickY ?? null,
            event.scrollDepth ?? null,
            event.timestamp
          ]);
        });

        stmt.finalize();
        
        this.db.run('COMMIT', (err) => {
          if (err) {
            console.error('Error inserting events:', err);
            reject(err);
          } else {
            resolve();
          }
        });
      });
    });
  }

  getAggregatedMetrics() {
    return new Promise((resolve, reject) => {
      const queries = {
        totalEvents: 'SELECT COUNT(*) as count FROM events',
        totalSessions: 'SELECT COUNT(DISTINCT session_id) as count FROM events',
        topClickedElements: `
          SELECT element_selector, COUNT(*) as clicks 
          FROM events 
          WHERE event_type = 'click' AND element_selector IS NOT NULL
          GROUP BY element_selector 
          ORDER BY clicks DESC 
          LIMIT 10
        `,
        averageScrollDepth: `
          SELECT AVG(scroll_depth) as avg_depth 
          FROM events 
          WHERE event_type = 'scroll' AND scroll_depth IS NOT NULL
        `,
        recentActivity: `
          SELECT page_url, COUNT(*) as events_count
          FROM events 
          WHERE datetime(created_at) > datetime('now', '-1 hour')
          GROUP BY page_url 
          ORDER BY events_count DESC 
          LIMIT 5
        `
      };

      const results = {};
      let completed = 0;
      const total = Object.keys(queries).length;

      Object.keys(queries).forEach(key => {
        this.db.all(queries[key], (err, rows) => {
          if (err) {
            console.error(`Error executing query ${key}:`, err);
            reject(err);
            return;
          }

          results[key] = rows;
          completed++;

          if (completed === total) {
            resolve(results);
          }
        });
      });
    });
  }

  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('Database connection closed');
        }
      });
    }
  }
}

module.exports = Database;