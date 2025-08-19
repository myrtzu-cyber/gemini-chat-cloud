#!/usr/bin/env python3
"""
Debug script to check aventura field persistence in the database
"""
import sqlite3
import json
from pathlib import Path

def check_database():
    """Check the database for aventura field content"""
    db_path = Path("database/chats.db")
    
    if not db_path.exists():
        print("❌ Database file not found at database/chats.db")
        return
    
    try:
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row  # Enable column access by name
        cursor = conn.cursor()
        
        # Check if aventura column exists
        cursor.execute("PRAGMA table_info(chats)")
        columns = cursor.fetchall()
        column_names = [col['name'] for col in columns]
        
        print("📋 Database columns:")
        for col in column_names:
            print(f"  - {col}")
        
        if 'aventura' not in column_names:
            print("❌ 'aventura' column not found in database!")
            return
        
        print("\n✅ 'aventura' column exists")
        
        # Get all chats with their aventura content and compression time
        cursor.execute("SELECT id, title, aventura, lastCompressionTime, updated_at FROM chats ORDER BY updated_at DESC")
        chats = cursor.fetchall()

        print(f"\n📊 Found {len(chats)} chats:")

        for chat in chats:
            aventura_content = chat['aventura'] or ''
            aventura_length = len(aventura_content)
            compression_time = chat['lastCompressionTime']

            print(f"\n🗂️ Chat: {chat['id']}")
            print(f"   Title: {chat['title']}")
            print(f"   Updated: {chat['updated_at']}")
            print(f"   Aventura length: {aventura_length} characters")

            if compression_time:
                try:
                    import datetime
                    comp_date = datetime.datetime.fromtimestamp(int(compression_time) / 1000)
                    print(f"   Last compression: {comp_date.strftime('%Y-%m-%d %H:%M:%S')}")
                except:
                    print(f"   Last compression: {compression_time} (raw)")
            else:
                print("   Last compression: Never")

            if aventura_length > 0:
                # Show first 100 characters of aventura content
                preview = aventura_content[:100].replace('\n', ' ')
                print(f"   Aventura preview: {preview}...")
            else:
                print("   Aventura: (empty)")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Error checking database: {e}")

if __name__ == "__main__":
    print("🔍 Debugging aventura field persistence...")
    check_database()
