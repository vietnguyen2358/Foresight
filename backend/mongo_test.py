"""
MongoDB Test Script

This script tests connection to MongoDB and performs basic CRUD operations.
"""

from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
from dotenv import load_dotenv
import os
import uuid
import json
from datetime import datetime

# Load environment variables
load_dotenv()

# Get MongoDB password from environment
password = os.getenv("DB_PASS")
if not password:
    print("ERROR: DB_PASS environment variable not found or empty")
    exit(1)

print(f"Using password from environment (first 2 chars): {password[:2]}***")

# MongoDB Connection Setup
uri = f"mongodb+srv://vietnguyen2358:{password}@cluster0.sysyjal.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"

# Create a new client and connect to the server
print("Connecting to MongoDB...")
client = MongoClient(uri, server_api=ServerApi('1'))

# Send a ping to confirm a successful connection
try:
    client.admin.command('ping')
    print("✅ Successfully connected to MongoDB!")
except Exception as e:
    print(f"❌ Failed to connect to MongoDB: {e}")
    exit(1)

# Setup database and collection for testing
db = client['foresight_test']
collection = db['test_data']

# Test write operation
print("\n--- Testing Write Operation ---")
try:
    # Create a test document
    test_id = str(uuid.uuid4())
    test_doc = {
        "id": test_id,
        "test_name": "mongodb_connection_test",
        "timestamp": datetime.now().isoformat(),
        "data": {
            "number": 42,
            "string": "Hello MongoDB",
            "list": [1, 2, 3],
            "nested": {
                "a": 1,
                "b": 2
            }
        }
    }
    
    # Insert the document
    result = collection.insert_one(test_doc)
    
    if result.acknowledged:
        print(f"✅ Successfully wrote test document with ID: {test_id}")
    else:
        print("❌ Write operation not acknowledged")
except Exception as e:
    print(f"❌ Write operation failed: {e}")

# Test read operation
print("\n--- Testing Read Operation ---")
try:
    # Query the document we just inserted
    found_doc = collection.find_one({"id": test_id})
    
    if found_doc:
        print("✅ Successfully read test document:")
        # Remove MongoDB _id field for display
        if "_id" in found_doc:
            del found_doc["_id"]
        print(json.dumps(found_doc, indent=2))
    else:
        print(f"❌ Could not find document with ID: {test_id}")
except Exception as e:
    print(f"❌ Read operation failed: {e}")

# Test update operation
print("\n--- Testing Update Operation ---")
try:
    # Update the document
    update_result = collection.update_one(
        {"id": test_id},
        {"$set": {"updated": True, "update_time": datetime.now().isoformat()}}
    )
    
    if update_result.modified_count == 1:
        print("✅ Successfully updated test document")
    else:
        print(f"❌ Update operation did not modify any documents (matched: {update_result.matched_count})")
    
    # Verify update
    updated_doc = collection.find_one({"id": test_id})
    if updated_doc and updated_doc.get("updated") == True:
        print("✅ Verified update was successful")
    else:
        print("❌ Failed to verify update")
except Exception as e:
    print(f"❌ Update operation failed: {e}")

# Test delete operation
print("\n--- Testing Delete Operation ---")
try:
    # Delete the document
    delete_result = collection.delete_one({"id": test_id})
    
    if delete_result.deleted_count == 1:
        print("✅ Successfully deleted test document")
    else:
        print(f"❌ Delete operation did not remove any documents")
    
    # Verify deletion
    verify_deletion = collection.find_one({"id": test_id})
    if not verify_deletion:
        print("✅ Verified deletion was successful")
    else:
        print("❌ Failed to verify deletion")
except Exception as e:
    print(f"❌ Delete operation failed: {e}")

# Cleanup - drop the test collection
print("\n--- Cleaning Up ---")
try:
    collection.drop()
    print("✅ Test collection dropped successfully")
except Exception as e:
    print(f"❌ Failed to drop test collection: {e}")

print("\n--- Test Complete ---")
print("MongoDB connection and CRUD operations test completed.") 