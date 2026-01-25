#!/usr/bin/env npx tsx
/**
 * Database Migration Runner
 *
 * Runs SQL migrations in order with tracking to prevent duplicate runs.
 * Migrations are stored in database/migrations/ and tracked in schema_migrations table.
 *
 * Usage:
 *   npm run db:migrate           # Run pending migrations
 *   npm run db:migrate:status    # Show migration status
 *   npm run db:migrate:reset     # Reset and re-run all migrations (DANGER)
 */

import { Pool } from 'pg';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

// Configuration
const MIGRATIONS_DIR = path.join(__dirname, '..', 'database', 'migrations');
const SCHEMA_FILE = path.join(__dirname, '..', 'database', 'schema.sql');

interface Migration {
  filename: string;
  checksum: string;
  executed_at?: Date;
  execution_time_ms?: number;
}

async function getPool(): Promise<Pool> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  return new Pool({ connectionString: databaseUrl });
}

async function calculateChecksum(content: string): Promise<string> {
  return createHash('sha256').update(content).digest('hex').substring(0, 16);
}

async function ensureMigrationsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      checksum VARCHAR(64),
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      execution_time_ms INTEGER
    )
  `);
}

async function getExecutedMigrations(pool: Pool): Promise<Map<string, Migration>> {
  const result = await pool.query(
    'SELECT filename, checksum, executed_at, execution_time_ms FROM schema_migrations ORDER BY filename'
  );
  const migrations = new Map<string, Migration>();
  for (const row of result.rows) {
    migrations.set(row.filename, row);
  }
  return migrations;
}

async function getMigrationFiles(): Promise<string[]> {
  try {
    const files = await fs.readdir(MIGRATIONS_DIR);
    return files
      .filter(f => f.endsWith('.sql'))
      .sort(); // Sort alphabetically (000_, 001_, 002_, etc.)
  } catch {
    return [];
  }
}

async function runMigration(
  pool: Pool,
  filename: string,
  content: string,
  checksum: string
): Promise<number> {
  const client = await pool.connect();
  const startTime = Date.now();

  try {
    await client.query('BEGIN');

    // Run the migration
    await client.query(content);

    // Record the migration
    await client.query(
      `INSERT INTO schema_migrations (filename, checksum, execution_time_ms)
       VALUES ($1, $2, $3)
       ON CONFLICT (filename) DO UPDATE SET
         checksum = EXCLUDED.checksum,
         executed_at = NOW(),
         execution_time_ms = EXCLUDED.execution_time_ms`,
      [filename, checksum, Date.now() - startTime]
    );

    await client.query('COMMIT');
    return Date.now() - startTime;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function runSchema(pool: Pool): Promise<void> {
  console.log('Running schema.sql...');
  const startTime = Date.now();

  try {
    const content = await fs.readFile(SCHEMA_FILE, 'utf-8');
    const checksum = await calculateChecksum(content);

    // Check if schema has changed
    const executed = await getExecutedMigrations(pool);
    const schemaRecord = executed.get('schema.sql');

    if (schemaRecord && schemaRecord.checksum === checksum) {
      console.log('  Schema unchanged, skipping');
      return;
    }

    await runMigration(pool, 'schema.sql', content, checksum);
    console.log(`  Completed in ${Date.now() - startTime}ms`);
  } catch (error) {
    console.error(`  Failed: ${error instanceof Error ? error.message : error}`);
    throw error;
  }
}

async function migrate(): Promise<void> {
  console.log('Database Migration Runner');
  console.log('='.repeat(50));

  const pool = await getPool();

  try {
    // Ensure migrations table exists
    await ensureMigrationsTable(pool);

    // Run main schema first
    await runSchema(pool);

    // Get executed migrations
    const executed = await getExecutedMigrations(pool);

    // Get migration files
    const files = await getMigrationFiles();

    if (files.length === 0) {
      console.log('\nNo migration files found');
      return;
    }

    console.log(`\nFound ${files.length} migration file(s)`);

    let pending = 0;
    let completed = 0;

    for (const filename of files) {
      const filePath = path.join(MIGRATIONS_DIR, filename);
      const content = await fs.readFile(filePath, 'utf-8');
      const checksum = await calculateChecksum(content);

      const existing = executed.get(filename);

      if (existing) {
        if (existing.checksum !== checksum) {
          console.log(`\n  WARNING: ${filename} has changed since last run`);
          console.log(`    Previous checksum: ${existing.checksum}`);
          console.log(`    Current checksum:  ${checksum}`);
        }
        continue; // Skip already executed
      }

      pending++;
      console.log(`\nRunning: ${filename}`);

      try {
        const duration = await runMigration(pool, filename, content, checksum);
        console.log(`  Completed in ${duration}ms`);
        completed++;
      } catch (error) {
        console.error(`  FAILED: ${error instanceof Error ? error.message : error}`);
        throw error;
      }
    }

    console.log('\n' + '='.repeat(50));
    if (pending === 0) {
      console.log('All migrations are up to date');
    } else {
      console.log(`Completed ${completed}/${pending} pending migration(s)`);
    }
  } finally {
    await pool.end();
  }
}

async function status(): Promise<void> {
  console.log('Migration Status');
  console.log('='.repeat(50));

  const pool = await getPool();

  try {
    await ensureMigrationsTable(pool);

    const executed = await getExecutedMigrations(pool);
    const files = await getMigrationFiles();

    console.log('\nExecuted migrations:');
    for (const [filename, migration] of executed) {
      const date = migration.executed_at
        ? new Date(migration.executed_at).toISOString()
        : 'unknown';
      console.log(`  [x] ${filename} (${date})`);
    }

    console.log('\nPending migrations:');
    let pending = 0;
    for (const filename of files) {
      if (!executed.has(filename)) {
        console.log(`  [ ] ${filename}`);
        pending++;
      }
    }

    if (pending === 0) {
      console.log('  (none)');
    }

    console.log(`\nTotal: ${executed.size} executed, ${pending} pending`);
  } finally {
    await pool.end();
  }
}

async function reset(): Promise<void> {
  console.log('Resetting migrations...');
  console.log('WARNING: This will drop the migrations table');

  const pool = await getPool();

  try {
    await pool.query('DROP TABLE IF EXISTS schema_migrations');
    console.log('Migrations table dropped');

    // Re-run migrations
    await migrate();
  } finally {
    await pool.end();
  }
}

// CLI handler
const command = process.argv[2];

switch (command) {
  case 'status':
    status().catch(err => {
      console.error(err);
      process.exit(1);
    });
    break;
  case 'reset':
    reset().catch(err => {
      console.error(err);
      process.exit(1);
    });
    break;
  default:
    migrate().catch(err => {
      console.error(err);
      process.exit(1);
    });
}
