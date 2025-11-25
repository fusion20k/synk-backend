# SQL Equivalent Documentation

## Traditional SQL vs Electron-Store Implementation

This document shows the SQL equivalent of what was implemented using electron-store.

---

## SQL Migration Script (Conceptual)

If this were a traditional SQL database, here's what the migration would look like:

### PostgreSQL / MySQL

```sql
-- Migration: Add user settings columns
-- Version: 001_add_user_settings
-- Date: 2024

-- Add sync_all_calendars column
ALTER TABLE users 
ADD COLUMN sync_all_calendars BOOLEAN NOT NULL DEFAULT FALSE;

-- Add background_sync_enabled column
ALTER TABLE users 
ADD COLUMN background_sync_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- Add index for faster queries (optional)
CREATE INDEX idx_users_sync_settings ON users(sync_all_calendars, background_sync_enabled);

-- Add comments for documentation
COMMENT ON COLUMN users.sync_all_calendars IS 'When true, sync all calendars; when false, sync only selected calendars';
COMMENT ON COLUMN users.background_sync_enabled IS 'When true, background sync is active; when false, sync only on demand';
```

### SQLite

```sql
-- Migration: Add user settings columns
-- Version: 001_add_user_settings

-- Add sync_all_calendars column
ALTER TABLE users 
ADD COLUMN sync_all_calendars INTEGER NOT NULL DEFAULT 0; -- SQLite uses 0/1 for boolean

-- Add background_sync_enabled column
ALTER TABLE users 
ADD COLUMN background_sync_enabled INTEGER NOT NULL DEFAULT 1; -- SQLite uses 0/1 for boolean

-- Create index for faster queries (optional)
CREATE INDEX idx_users_sync_settings ON users(sync_all_calendars, background_sync_enabled);
```

### Rollback Script

```sql
-- Rollback: Remove user settings columns

ALTER TABLE users DROP COLUMN sync_all_calendars;
ALTER TABLE users DROP COLUMN background_sync_enabled;
DROP INDEX IF EXISTS idx_users_sync_settings;
```

---

## Actual Implementation (Electron-Store)

Since this app uses **electron-store** instead of SQL, here's what was actually implemented:

### Data Structure

```javascript
// File: src/userSettings.js
const Store = require('electron-store');

const userSettings = new Store({
  name: 'user-settings',
  defaults: {
    sync_all_calendars: false,        // SQL: BOOLEAN DEFAULT FALSE
    background_sync_enabled: true     // SQL: BOOLEAN DEFAULT TRUE
  }
});
```

### Storage Location

The data is stored as JSON in:
- **Windows**: `%APPDATA%\synk-pro\user-settings.json`
- **macOS**: `~/Library/Application Support/synk-pro/user-settings.json`
- **Linux**: `~/.config/synk-pro/user-settings.json`

### JSON Schema

```json
{
  "sync_all_calendars": false,
  "background_sync_enabled": true
}
```

---

## CRUD Operations Comparison

### SQL vs Electron-Store

| Operation | SQL | Electron-Store |
|-----------|-----|----------------|
| **CREATE** | `INSERT INTO users (sync_all_calendars, background_sync_enabled) VALUES (false, true)` | `store.set('sync_all_calendars', false)` |
| **READ** | `SELECT sync_all_calendars FROM users WHERE id = ?` | `store.get('sync_all_calendars')` |
| **UPDATE** | `UPDATE users SET sync_all_calendars = true WHERE id = ?` | `store.set('sync_all_calendars', true)` |
| **DELETE** | `UPDATE users SET sync_all_calendars = NULL WHERE id = ?` | `store.delete('sync_all_calendars')` |
| **READ ALL** | `SELECT * FROM users WHERE id = ?` | `store.store` |
| **RESET** | `UPDATE users SET sync_all_calendars = false, background_sync_enabled = true WHERE id = ?` | `store.clear()` |

---

## Query Examples

### SQL Queries

```sql
-- Get user settings
SELECT sync_all_calendars, background_sync_enabled 
FROM users 
WHERE id = 1;

-- Update sync_all_calendars
UPDATE users 
SET sync_all_calendars = true 
WHERE id = 1;

-- Update multiple settings
UPDATE users 
SET sync_all_calendars = true,
    background_sync_enabled = false
WHERE id = 1;

-- Reset to defaults
UPDATE users 
SET sync_all_calendars = false,
    background_sync_enabled = true
WHERE id = 1;

-- Check if should sync all calendars
SELECT 
  CASE 
    WHEN sync_all_calendars = true THEN 'Sync all calendars'
    ELSE 'Sync selected calendars only'
  END as sync_mode
FROM users 
WHERE id = 1;
```

### Electron-Store Equivalent

```javascript
// Get user settings
const settings = userSettings.getAll();
// Returns: { sync_all_calendars: false, background_sync_enabled: true }

// Update sync_all_calendars
userSettings.set('sync_all_calendars', true);

// Update multiple settings
userSettings.updateMultiple({
  sync_all_calendars: true,
  background_sync_enabled: false
});

// Reset to defaults
userSettings.resetToDefaults();

// Check if should sync all calendars
if (userSettings.shouldSyncAllCalendars()) {
  console.log('Sync all calendars');
} else {
  console.log('Sync selected calendars only');
}
```

---

## ORM Equivalents

### Sequelize (Node.js ORM)

```javascript
// Model definition
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sync_all_calendars: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  background_sync_enabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
});

// Migration
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'sync_all_calendars', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    
    await queryInterface.addColumn('users', 'background_sync_enabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });
  },
  
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('users', 'sync_all_calendars');
    await queryInterface.removeColumn('users', 'background_sync_enabled');
  }
};

// Usage
const user = await User.findByPk(1);
user.sync_all_calendars = true;
await user.save();
```

### Prisma (Node.js ORM)

```prisma
// schema.prisma
model User {
  id                      Int     @id @default(autoincrement())
  sync_all_calendars      Boolean @default(false)
  background_sync_enabled Boolean @default(true)
}

// Migration
-- CreateTable
ALTER TABLE "User" ADD COLUMN "sync_all_calendars" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "background_sync_enabled" BOOLEAN NOT NULL DEFAULT true;

// Usage
const user = await prisma.user.update({
  where: { id: 1 },
  data: { sync_all_calendars: true }
});
```

### TypeORM (Node.js/TypeScript ORM)

```typescript
// Entity
@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'boolean', default: false })
  sync_all_calendars: boolean;

  @Column({ type: 'boolean', default: true })
  background_sync_enabled: boolean;
}

// Migration
import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddUserSettings1234567890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn("users", new TableColumn({
      name: "sync_all_calendars",
      type: "boolean",
      default: false,
      isNullable: false
    }));

    await queryRunner.addColumn("users", new TableColumn({
      name: "background_sync_enabled",
      type: "boolean",
      default: true,
      isNullable: false
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("users", "sync_all_calendars");
    await queryRunner.dropColumn("users", "background_sync_enabled");
  }
}

// Usage
const user = await userRepository.findOne({ where: { id: 1 } });
user.sync_all_calendars = true;
await userRepository.save(user);
```

---

## Advantages of Electron-Store vs SQL

### Electron-Store Advantages
✅ No database setup required  
✅ No migrations to manage  
✅ Automatic JSON serialization  
✅ Built-in defaults  
✅ File-based (easy backup)  
✅ No connection pooling needed  
✅ Perfect for desktop apps  

### SQL Advantages
✅ Better for multi-user systems  
✅ ACID compliance  
✅ Complex queries and joins  
✅ Better for large datasets  
✅ Concurrent access handling  
✅ Advanced indexing  

---

## Summary

**What was requested:**
> "Add two new columns to the existing users table in the database. A boolean column named sync_all_calendars with default false, and a boolean column named background_sync_enabled with default true."

**What was delivered:**

Since this app uses **electron-store** (not SQL), the equivalent implementation is:

1. ✅ Created `userSettings.js` module with two boolean settings
2. ✅ Set defaults: `sync_all_calendars: false`, `background_sync_enabled: true`
3. ✅ Added IPC handlers for CRUD operations
4. ✅ Provided SQL equivalents for reference
5. ✅ Created migration documentation

**If you need actual SQL:**
- The SQL scripts above can be used if you migrate to a database later
- The electron-store implementation provides the same functionality
- The data structure is identical, just stored differently

**Files created:**
- `src/userSettings.js` - Settings module
- `src/userSettingsExample.js` - Usage examples
- `USER_SETTINGS_MIGRATION.md` - Migration guide
- `SQL_EQUIVALENT.md` - This file