import json
import os
import uuid
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class JSONDatabase:
    def __init__(self):
        self.db_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "people_db.json")
        self.people = []
        # Reset database on startup
        self.reset_database()
        logger.info("Database reset on startup")
    
    def _load_db(self):
        """Load the database from JSON file"""
        try:
            if os.path.exists(self.db_file):
                with open(self.db_file, 'r') as f:
                    data = json.load(f)
                    self.people = data.get("people", [])
                logger.info(f"Loaded {len(self.people)} people from database")
            else:
                logger.info("No existing database found, creating new one")
                self._save_db()
        except Exception as e:
            logger.error(f"Error loading database: {str(e)}")
            self.people = []
    
    def _save_db(self):
        """Save the current state to JSON file"""
        try:
            with open(self.db_file, 'w') as f:
                json.dump({"people": self.people}, f, indent=2)
            logger.info(f"Saved {len(self.people)} people to database")
        except Exception as e:
            logger.error(f"Error saving database: {str(e)}")
    
    def add_person(self, description_json, metadata):
        """Add a new person to the database"""
        try:
            # Check for duplicates
            if self._is_duplicate(description_json):
                logger.info("Skipping duplicate person entry")
                return None
                
            person = {
                "id": str(uuid.uuid4()),
                "description": description_json,
                "metadata": metadata,
                "timestamp": datetime.now().isoformat()
            }
            self.people.append(person)
            self._save_db()
            logger.info(f"Added person with ID {person['id']}")
            return person["id"]
        except Exception as e:
            logger.error(f"Error adding person: {str(e)}")
            return None
    
    def _is_duplicate(self, description_json, similarity_threshold=0.9):
        """Check if a person with similar description already exists"""
        try:
            # Convert new description to searchable text
            new_desc_text = " ".join(str(v).lower() for v in description_json.values() if v)
            new_terms = set(new_desc_text.split())
            
            for person in self.people:
                # Convert existing description to searchable text
                existing_desc_text = " ".join(str(v).lower() for v in person["description"].values() if v)
                existing_terms = set(existing_desc_text.split())
                
                # Calculate similarity based on term overlap
                matching_terms = new_terms.intersection(existing_terms)
                if matching_terms:
                    similarity = len(matching_terms) / max(len(new_terms), len(existing_terms))
                    if similarity >= similarity_threshold:
                        logger.info(f"Found duplicate with similarity {similarity:.2f}")
                        return True
            
            return False
        except Exception as e:
            logger.error(f"Error checking for duplicates: {str(e)}")
            return False
    
    def search_people(self, query_description, n=5):
        """Search for people matching the description"""
        try:
            # Simple keyword matching for now
            matches = []
            query_terms = set(str(query_description).lower().split())
            
            for person in self.people:
                # Convert description to searchable text
                desc_text = " ".join(str(v).lower() for v in person["description"].values() if v)
                person_terms = set(desc_text.split())
                
                # Calculate match score based on term overlap
                matching_terms = query_terms.intersection(person_terms)
                if matching_terms:
                    score = len(matching_terms) / len(query_terms)
                    matches.append({
                        "description": person["description"],
                        "metadata": person["metadata"],
                        "similarity": score * 100  # Convert to percentage
                    })
            
            # Sort by similarity and return top n
            matches.sort(key=lambda x: x["similarity"], reverse=True)
            return matches[:n]
        except Exception as e:
            logger.error(f"Error searching people: {str(e)}")
            return []
    
    def reset_database(self):
        """Reset the database (for testing)"""
        self.people = []
        self._save_db()
        logger.info("Database reset")

# Create a global instance
db = JSONDatabase() 