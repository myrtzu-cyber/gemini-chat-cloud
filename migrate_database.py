#!/usr/bin/env python3
"""
Database Migration Script for Gemini Mobile Chat
==============================================

This script handles database schema migration for backup databases that may be missing
recently added columns. It's designed to be safe, idempotent, and provide clear feedback.

Usage:
    python migrate_database.py [database_path]

If no database path is provided, it will use the default: database/chats.db

Features:
- Detects missing columns automatically
- Adds missing columns without data loss
- Provides detailed console output
- Safe to run multiple times (idempotent)
- Handles common database issues gracefully
"""

import sqlite3
import os
import sys
import json
from pathlib import Path
from datetime import datetime

class DatabaseMigrator:
    def __init__(self, db_path="database/chats.db"):
        self.db_path = Path(db_path)
        self.backup_path = None
        
        # Define the expected schema with all columns
        self.expected_columns = {
            'id': 'TEXT PRIMARY KEY',
            'title': 'TEXT NOT NULL',
            'model': 'TEXT NOT NULL DEFAULT \'gemini-2.5-pro\'',
            'messages': 'TEXT DEFAULT \'[]\'',
            'master_rules': 'TEXT DEFAULT \'\'',
            'character_sheet': 'TEXT DEFAULT \'\'',
            'local_history': 'TEXT DEFAULT \'\'',
            'current_plot': 'TEXT DEFAULT \'\'',
            'relations': 'TEXT DEFAULT \'\'',
            'aventura': 'TEXT DEFAULT \'\'',
            'lastCompressionTime': 'TEXT DEFAULT NULL',
            'created_at': 'DATETIME DEFAULT CURRENT_TIMESTAMP',
            'updated_at': 'DATETIME DEFAULT CURRENT_TIMESTAMP'
        }
        
        # Track what changes were made
        self.changes_made = []
        self.errors = []

    def log(self, message, level="INFO"):
        """Log a message with timestamp and level"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] [{level}] {message}")

    def create_backup(self):
        """Create a backup of the database before migration"""
        if not self.db_path.exists():
            self.log("Database file does not exist, no backup needed", "INFO")
            return True
            
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            self.backup_path = self.db_path.parent / f"{self.db_path.stem}_backup_{timestamp}.db"
            
            # Copy the database file
            import shutil
            shutil.copy2(self.db_path, self.backup_path)
            
            self.log(f"Backup created: {self.backup_path}", "SUCCESS")
            return True
            
        except Exception as e:
            self.log(f"Failed to create backup: {e}", "ERROR")
            self.errors.append(f"Backup creation failed: {e}")
            return False

    def get_existing_columns(self):
        """Get the current columns in the chats table"""
        try:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()
            
            # Check if table exists
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='chats'")
            if not cursor.fetchone():
                self.log("Table 'chats' does not exist", "WARNING")
                conn.close()
                return {}
            
            # Get column information
            cursor.execute("PRAGMA table_info(chats)")
            columns = cursor.fetchall()
            conn.close()
            
            # Convert to dictionary: {column_name: (type, nullable, default, pk)}
            existing_columns = {}
            for col in columns:
                col_name = col[1]
                col_type = col[2]
                not_null = col[3]
                default_value = col[4]
                is_pk = col[5]
                
                existing_columns[col_name] = {
                    'type': col_type,
                    'not_null': not_null,
                    'default': default_value,
                    'primary_key': is_pk
                }
            
            return existing_columns
            
        except Exception as e:
            self.log(f"Error getting existing columns: {e}", "ERROR")
            self.errors.append(f"Failed to get existing columns: {e}")
            return {}

    def create_table_if_not_exists(self):
        """Create the chats table if it doesn't exist"""
        try:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()
            
            # Create the complete table with all expected columns
            columns_sql = []
            for col_name, col_definition in self.expected_columns.items():
                columns_sql.append(f"{col_name} {col_definition}")
            
            create_table_sql = f"""
            CREATE TABLE IF NOT EXISTS chats (
                {',\n                '.join(columns_sql)}
            )
            """
            
            cursor.execute(create_table_sql)
            conn.commit()
            conn.close()
            
            self.log("Table 'chats' created or verified", "SUCCESS")
            self.changes_made.append("Table 'chats' created or verified")
            return True
            
        except Exception as e:
            self.log(f"Error creating table: {e}", "ERROR")
            self.errors.append(f"Failed to create table: {e}")
            return False

    def add_missing_columns(self):
        """Add any missing columns to the existing table"""
        existing_columns = self.get_existing_columns()
        
        if not existing_columns:
            self.log("No existing columns found, creating new table", "INFO")
            return self.create_table_if_not_exists()
        
        try:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()
            
            columns_added = 0
            
            for col_name, col_definition in self.expected_columns.items():
                if col_name not in existing_columns:
                    try:
                        alter_sql = f"ALTER TABLE chats ADD COLUMN {col_name} {col_definition}"
                        cursor.execute(alter_sql)
                        
                        self.log(f"Added column: {col_name} {col_definition}", "SUCCESS")
                        self.changes_made.append(f"Added column: {col_name}")
                        columns_added += 1
                        
                    except Exception as e:
                        self.log(f"Error adding column {col_name}: {e}", "ERROR")
                        self.errors.append(f"Failed to add column {col_name}: {e}")
                else:
                    self.log(f"Column '{col_name}' already exists", "INFO")
            
            conn.commit()
            conn.close()
            
            if columns_added > 0:
                self.log(f"Successfully added {columns_added} missing columns", "SUCCESS")
            else:
                self.log("No missing columns found - database is up to date", "SUCCESS")
            
            return True
            
        except Exception as e:
            self.log(f"Error during column migration: {e}", "ERROR")
            self.errors.append(f"Column migration failed: {e}")
            return False

    def update_model_defaults(self):
        """Update any chats with old model defaults to use gemini-2.5-pro"""
        try:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()
            
            # Check for chats with old model values
            old_models = ['gemini-pro', 'gemini-1.5-pro-latest', 'gemini-1.5-flash-latest']
            
            for old_model in old_models:
                cursor.execute("SELECT COUNT(*) FROM chats WHERE model = ?", (old_model,))
                count = cursor.fetchone()[0]
                
                if count > 0:
                    cursor.execute("UPDATE chats SET model = 'gemini-2.5-pro' WHERE model = ?", (old_model,))
                    self.log(f"Updated {count} chats from '{old_model}' to 'gemini-2.5-pro'", "SUCCESS")
                    self.changes_made.append(f"Updated {count} chats from '{old_model}' to 'gemini-2.5-pro'")
            
            conn.commit()
            conn.close()
            return True
            
        except Exception as e:
            self.log(f"Error updating model defaults: {e}", "ERROR")
            self.errors.append(f"Failed to update model defaults: {e}")
            return False

    def verify_migration(self):
        """Verify that the migration was successful"""
        try:
            existing_columns = self.get_existing_columns()
            
            missing_columns = []
            for expected_col in self.expected_columns:
                if expected_col not in existing_columns:
                    missing_columns.append(expected_col)
            
            if missing_columns:
                self.log(f"Migration verification failed - missing columns: {missing_columns}", "ERROR")
                return False
            else:
                self.log("Migration verification successful - all expected columns present", "SUCCESS")
                return True
                
        except Exception as e:
            self.log(f"Error during verification: {e}", "ERROR")
            return False

    def migrate(self):
        """Run the complete migration process"""
        self.log("Starting database migration", "INFO")
        self.log(f"Database path: {self.db_path.absolute()}", "INFO")
        
        # Ensure database directory exists
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Create backup if database exists
        if not self.create_backup():
            self.log("Migration aborted due to backup failure", "ERROR")
            return False
        
        # Run migration steps
        steps = [
            ("Creating/verifying table", self.create_table_if_not_exists),
            ("Adding missing columns", self.add_missing_columns),
            ("Updating model defaults", self.update_model_defaults),
            ("Verifying migration", self.verify_migration)
        ]
        
        for step_name, step_function in steps:
            self.log(f"Step: {step_name}", "INFO")
            if not step_function():
                self.log(f"Migration failed at step: {step_name}", "ERROR")
                return False
        
        # Print summary
        self.print_summary()
        return len(self.errors) == 0

    def print_summary(self):
        """Print a summary of the migration results"""
        print("\n" + "="*60)
        print("MIGRATION SUMMARY")
        print("="*60)
        
        if self.changes_made:
            print("\n✅ CHANGES MADE:")
            for change in self.changes_made:
                print(f"  • {change}")
        else:
            print("\n✅ NO CHANGES NEEDED - Database was already up to date")
        
        if self.errors:
            print("\n❌ ERRORS ENCOUNTERED:")
            for error in self.errors:
                print(f"  • {error}")
        
        if self.backup_path and self.backup_path.exists():
            print(f"\n💾 BACKUP CREATED: {self.backup_path}")
        
        print("\n" + "="*60)

def main():
    """Main function to run the migration"""
    # Get database path from command line argument or use default
    if len(sys.argv) > 1:
        db_path = sys.argv[1]
    else:
        db_path = "database/chats.db"
    
    print("Gemini Mobile Chat - Database Migration Tool")
    print("=" * 50)
    
    migrator = DatabaseMigrator(db_path)
    success = migrator.migrate()
    
    if success:
        print("\n🎉 Migration completed successfully!")
        sys.exit(0)
    else:
        print("\n💥 Migration failed! Check the errors above.")
        sys.exit(1)

if __name__ == "__main__":
    main()
