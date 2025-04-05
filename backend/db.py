# db.py

from json_db import db

def reset_collection():
    """Reset the database (for debugging/testing)."""
    db.reset_database()
    return db

def add_person(description_json, metadata={}):
    """Add a person to the database."""
    return db.add_person(description_json, metadata)

def search_people(query_description, n=3):
    """Search for similar people in the database."""
    return db.search_people(query_description, n)