#!/usr/bin/env node

const { getDatabase, closeDatabase, DB_PATH } = require('../src/config/database');

console.log('Initializing Eyezo Server database...');
console.log(`Database location: ${DB_PATH}`);

try {
  const db = getDatabase();

  console.log('Database schema created successfully!');
  console.log('\nTables created:');
  console.log('  - videos (metadata cache)');
  console.log('  - config (server settings)');
  console.log('  - scan_history (scan tracking)');

  // Verify tables were created
  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table'
    ORDER BY name
  `).all();

  console.log('\nVerified tables:');
  tables.forEach(table => {
    console.log(`  ✓ ${table.name}`);
  });

  closeDatabase();
  console.log('\nDatabase initialization complete!');
} catch (error) {
  console.error('Error initializing database:', error);
  process.exit(1);
}
