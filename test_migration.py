#!/usr/bin/env python3
"""
Test script to verify the database migration functionality
Creates a test database with missing columns to test the migration script
"""

import sqlite3
import os
import sys
from pathlib import Path

def create_test_database():
    """Create a test database with old schema (missing recent columns)"""
    test_db_path = Path("test_database/chats.db")
    test_db_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Remove existing test database
    if test_db_path.exists():
        test_db_path.unlink()
    
    print(f"Creating test database: {test_db_path}")
    
    # Create database with old schema (missing lastCompressionTime and aventura)
    conn = sqlite3.connect(str(test_db_path))
    cursor = conn.cursor()
    
    # Create table with old schema
    cursor.execute("""
        CREATE TABLE chats (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            model TEXT NOT NULL DEFAULT 'gemini-pro',
            messages TEXT DEFAULT '[]',
            master_rules TEXT DEFAULT '',
            character_sheet TEXT DEFAULT '',
            local_history TEXT DEFAULT '',
            current_plot TEXT DEFAULT '',
            relations TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Insert some test data
    test_data = [
        ('test-chat-1', 'Test Chat 1', 'gemini-pro', '[]', 'Test rules', '', '', '', ''),
        ('test-chat-2', 'Test Chat 2', 'gemini-1.5-pro-latest', '[]', '', 'Test character', '', '', ''),
        ('test-chat-3', 'Test Chat 3', 'gemini-1.5-flash-latest', '[]', '', '', 'Test history', '', ''),
    ]
    
    cursor.executemany("""
        INSERT INTO chats (id, title, model, messages, master_rules, character_sheet, local_history, current_plot, relations)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, test_data)
    
    conn.commit()
    conn.close()
    
    print("✅ Test database created with old schema")
    print("Missing columns: aventura, lastCompressionTime")
    print("Old model values: gemini-pro, gemini-1.5-pro-latest, gemini-1.5-flash-latest")
    
    return test_db_path

def verify_test_database(db_path):
    """Verify the test database has the expected old schema"""
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    # Get column information
    cursor.execute("PRAGMA table_info(chats)")
    columns = cursor.fetchall()
    
    print(f"\nTest database columns:")
    for col in columns:
        print(f"  - {col[1]} ({col[2]})")
    
    # Check for missing columns
    column_names = [col[1] for col in columns]
    missing_columns = []
    
    expected_new_columns = ['aventura', 'lastCompressionTime']
    for col in expected_new_columns:
        if col not in column_names:
            missing_columns.append(col)
    
    if missing_columns:
        print(f"\n✅ Missing columns confirmed: {missing_columns}")
    else:
        print(f"\n❌ No missing columns found - test setup failed")
    
    # Check model values
    cursor.execute("SELECT id, title, model FROM chats")
    chats = cursor.fetchall()
    
    print(f"\nTest data:")
    for chat in chats:
        print(f"  - {chat[0]}: {chat[1]} (model: {chat[2]})")
    
    conn.close()

def main():
    """Main function to create and verify test database"""
    print("Creating test database for migration testing...")
    print("=" * 50)
    
    test_db_path = create_test_database()
    verify_test_database(test_db_path)
    
    print(f"\n🎯 Test database ready!")
    print(f"Run migration with: python migrate_database.py {test_db_path}")

if __name__ == "__main__":
    main()
