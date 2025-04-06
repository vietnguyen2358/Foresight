import json
import os
import uuid
from datetime import datetime
import logging
import base64
import cv2
import numpy as np
from PIL import Image
import io

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class JSONDatabase:
    def __init__(self):
        self.db_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "people_db.json")
        self.people = []
        # Create directory for storing detected people images
        self.detected_people_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "detected_people")
        os.makedirs(self.detected_people_dir, exist_ok=True)
        # Load existing database
        self._load_db()
        logger.info("Database loaded")
    
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
    
    def add_person(self, description_json, metadata, crop_image=None):
        """Add a new person to the database"""
        try:
            # Check for duplicates
            if self._is_duplicate(description_json):
                logger.info("Skipping duplicate person entry")
                return None
                
            # Generate a unique ID for this person
            person_id = str(uuid.uuid4())
            
            # Save the cropped image if provided
            image_path = None
            if crop_image:
                # Create a directory for this person if it doesn't exist
                person_dir = os.path.join(self.detected_people_dir, person_id)
                os.makedirs(person_dir, exist_ok=True)
                
                # Save the image
                image_path = os.path.join(person_dir, "person.jpg")
                
                # If crop_image is a base64 string, decode it
                if isinstance(crop_image, str) and crop_image.startswith('data:image'):
                    # Extract the base64 part
                    base64_data = crop_image.split(',')[1]
                    image_data = base64.b64decode(base64_data)
                    with open(image_path, 'wb') as f:
                        f.write(image_data)
                else:
                    # If it's already a file path or binary data
                    with open(image_path, 'wb') as f:
                        f.write(crop_image)
                
                logger.info(f"Saved person image to {image_path}")
            
            person = {
                "id": person_id,
                "description": description_json,
                "metadata": metadata,
                "timestamp": datetime.now().isoformat(),
                "image_path": image_path
            }
            self.people.append(person)
            self._save_db()
            logger.info(f"Added person with ID {person['id']}")
            return person["id"]
        except Exception as e:
            logger.error(f"Error adding person: {str(e)}")
            return None
    
    def get_person_image(self, person_id):
        """Get the image path for a person"""
        try:
            for person in self.people:
                if person["id"] == person_id and "image_path" in person:
                    image_path = person["image_path"]
                    if image_path and os.path.exists(image_path):
                        return image_path
                    else:
                        # If the image path doesn't exist, try the standard location
                        standard_path = os.path.join(self.detected_people_dir, person_id, "person.jpg")
                        if os.path.exists(standard_path):
                            return standard_path
            return None
        except Exception as e:
            logger.error(f"Error getting person image: {str(e)}")
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
            # Define attribute weights for better matching
            attribute_weights = {
                'gender': 3.0,
                'age_group': 2.5,
                'hair_color': 2.0,
                'hair_style': 1.5,
                'facial_features': 2.0,
                'clothing_top': 2.0,
                'clothing_top_color': 2.0,
                'clothing_bottom': 1.5,
                'clothing_bottom_color': 1.5,
                'accessories': 1.0,
                'location_context': 0.5
            }
            
            # Handle both string and JSON query descriptions
            if isinstance(query_description, str):
                # Convert string query to searchable terms
                query_terms = set(str(query_description).lower().split())
                query_json = {}
            else:
                # Use structured JSON query
                query_json = query_description
                query_terms = set()
                for value in query_description.values():
                    if isinstance(value, str):
                        query_terms.update(value.lower().split())
            
            matches = []
            
            for person in self.people:
                # Initialize weighted similarity score
                total_weight = 0
                weighted_matches = 0
                matched_attributes = 0
                
                # Check each attribute with its weight
                for attr, weight in attribute_weights.items():
                    if attr in person["description"]:
                        attr_value = str(person["description"][attr]).lower()
                        attr_terms = set(attr_value.split())
                        
                        # Calculate term overlap for this attribute
                        matching_terms = query_terms.intersection(attr_terms)
                        term_similarity = len(matching_terms) / max(len(query_terms), len(attr_terms)) if query_terms else 0
                        
                        # If we have a structured query, check for exact matches
                        if query_json and attr in query_json:
                            query_value = str(query_json[attr]).lower()
                            if query_value == attr_value:
                                # Exact match gets full weight
                                weighted_matches += weight
                                total_weight += weight
                                matched_attributes += 1
                            elif matching_terms:
                                # Partial match gets reduced weight
                                weighted_matches += weight * term_similarity * 0.7
                                total_weight += weight
                                matched_attributes += 1
                        elif matching_terms:
                            # For string queries, use term similarity
                            weighted_matches += weight * term_similarity
                            total_weight += weight
                            matched_attributes += 1
                
                # Calculate final similarity score with normalization
                if total_weight > 0:
                    # Base similarity from weighted matches
                    base_similarity = weighted_matches / total_weight
                    
                    # Boost score based on number of matched attributes
                    attribute_boost = min(matched_attributes / len(attribute_weights), 1.0)
                    
                    # Combine base similarity with attribute boost
                    similarity = (base_similarity * 0.7) + (attribute_boost * 0.3)
                    
                    # Scale similarity to be more intuitive (0-1 range)
                    similarity = min(max(similarity, 0.0), 1.0)
                    
                    matches.append((person, similarity))
            
            # Sort by similarity (highest first)
            matches.sort(key=lambda x: x[1], reverse=True)
            
            # Return top N matches with their similarity scores
            return [{
                **match[0],
                "similarity": match[1]
            } for match in matches[:n]]
            
        except Exception as e:
            logger.error(f"Error searching people: {str(e)}")
            return []
    
    def reset_database(self):
        """Reset the database to empty state"""
        self.people = []
        self._save_db()
        logger.info("Database reset to empty state")
        return self

# Create a singleton instance
db = JSONDatabase() 