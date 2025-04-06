# db.py

from json_db import db

def reset_collection():
    """Reset the database (for debugging/testing)."""
    db.reset_database()
    return db

def add_person(description_json, metadata={}, crop_image=None):
    """Add a person to the database."""
    return db.add_person(description_json, metadata, crop_image)

def search_people(query_description, n=3):
    """Search for similar people in the database."""
    return db.search_people(query_description, n)

def get_person_image(person_id):
    """Get the image path for a person."""
    # Make sure we're returning the actual path, not a coroutine
    image_path = db.get_person_image(person_id)
    # Ensure we're returning a string or None, not a coroutine
    if hasattr(image_path, '__await__'):
        # If it's a coroutine, we need to run it
        import asyncio
        image_path = asyncio.run(image_path)
    return image_path