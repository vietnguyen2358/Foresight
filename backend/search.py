# search.py

import json
import google.generativeai as genai
from db import load_database
import os
from dotenv import load_dotenv
import base64
from PIL import Image
from typing import List, Dict, Any
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Gemini setup
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-2.0-flash-lite")

# Prompt for Gemini
QUERY_PROMPT_TEMPLATE = """
You are helping an AI vision system identify people.

Convert the following sentence into structured JSON with these attributes:
- gender (male, female, other)
- age_group (child, teen, adult, senior)
- ethnicity (if mentioned)
- skin_tone (light, medium, dark, etc.)
- hair_style (short, long, curly, straight, bald, etc.)
- hair_color (black, brown, blonde, red, gray, etc.)
- facial_features (beard, mustache, glasses, etc.)
- clothing_top (shirt, hoodie, t-shirt, jacket, etc.)
- clothing_top_color (primary color of top)
- clothing_top_pattern (solid, striped, plaid, floral, etc.)
- clothing_bottom (jeans, pants, skirt, shorts, etc.)
- clothing_bottom_color (primary color of bottom)
- clothing_bottom_pattern (solid, striped, plaid, etc.)
- footwear (sneakers, boots, sandals, etc.)
- footwear_color (primary color of shoes)
- accessories (bag, hat, jewelry, etc.)
- bag_type (backpack, handbag, shoulder bag, etc.)
- bag_color (primary color of bag)
- pose (standing, sitting, walking, etc.)
- location_context (indoor, outdoor, etc.)

Extract as much detail as possible from the description. If an attribute is not mentioned, omit it from the JSON.

Sentence: "{}"

Respond with ONLY a valid JSON object.
"""

def query_to_structured_json(query: str) -> Dict[str, Any]:
    """Convert a natural language query to structured JSON."""
    try:
        # Preprocess the query to better handle clothing color queries
        query = query.lower()
        
        # Handle "wearing" queries
        if "wearing" in query:
            # Extract color after "wearing"
            parts = query.split("wearing")
            if len(parts) > 1:
                color_part = parts[1].strip()
                # Check if it's a color query
                if any(color in color_part for color in ["grey", "gray", "black", "white", "red", "blue", "green", "yellow", "brown"]):
                    # Create a structured query focusing on the clothing color
                    query = f"Find a person with {color_part} clothing"
        
        # Handle "with" queries for colors
        if "with" in query and any(color in query for color in ["grey", "gray", "black", "white", "red", "blue", "green", "yellow", "brown"]):
            # Extract color after "with"
            parts = query.split("with")
            if len(parts) > 1:
                color_part = parts[1].strip()
                # Create a structured query focusing on the clothing color
                query = f"Find a person with {color_part} clothing"
        
        # Format the prompt with the processed query
        prompt = QUERY_PROMPT_TEMPLATE.format(query)
        
        # Get response from Gemini
        response = model.generate_content(prompt)
        
        # Clean up the response text by removing markdown formatting
        response_text = response.text.strip()
        if response_text.startswith("```json"):
            response_text = response_text[7:]  # Remove ```json prefix
        if response_text.endswith("```"):
            response_text = response_text[:-3]  # Remove ``` suffix
        response_text = response_text.strip()
        
        # Parse the response as JSON
        try:
            result = json.loads(response_text)
            logger.info(f"Parsed query JSON: {result}")
            return result
        except json.JSONDecodeError:
            logger.error(f"Failed to parse Gemini response as JSON: {response_text}")
            return {}
            
    except Exception as e:
        logger.error(f"Error in query_to_structured_json: {e}")
        return {}

def calculate_similarity(query_json: Dict[str, Any], person_json: Dict[str, Any]) -> float:
    """Calculate similarity between query and person descriptions."""
    try:
        # Define weights for different attributes
        weights = {
            'gender': 1.5,
            'age_group': 1.2,
            'hair_color': 1.2,
            'hair_style': 1.0,
            'facial_features': 1.5,
            'clothing_top': 1.2,
            'clothing_top_color': 2.0,  # Increased weight for clothing color
            'clothing_bottom': 1.0,
            'clothing_bottom_color': 1.5,  # Increased weight for bottom color
            'accessories': 1.0,
            'location_context': 0.5
        }
        
        # Color variations mapping
        color_variations = {
            'grey': ['gray', 'grey'],
            'gray': ['grey', 'gray'],
            'black': ['black', 'dark'],
            'white': ['white', 'light'],
            'red': ['red', 'maroon'],
            'blue': ['blue', 'navy'],
            'green': ['green', 'olive'],
            'yellow': ['yellow', 'gold'],
            'brown': ['brown', 'tan']
        }
        
        weighted_matches = 0
        weighted_total = 0
        
        for key in query_json:
            if key in person_json:
                weight = weights.get(key, 1.0)
                weighted_total += weight
                
                # Get the values to compare
                query_val = str(query_json[key]).lower()
                person_val = str(person_json[key]).lower()
                
                # Special handling for clothing colors
                if key in ['clothing_top_color', 'clothing_bottom_color']:
                    # Check for color variations
                    query_colors = set()
                    person_colors = set()
                    
                    # Add base colors
                    query_colors.add(query_val)
                    person_colors.add(person_val)
                    
                    # Add variations
                    for base_color, variations in color_variations.items():
                        if base_color in query_val:
                            query_colors.update(variations)
                        if base_color in person_val:
                            person_colors.update(variations)
                    
                    # Check for matches including variations
                    if query_colors & person_colors:  # If there's any intersection
                        weighted_matches += weight
                        logger.info(f"Match on {key} with variations: {query_colors} ~ {person_colors}")
                    else:
                        # Check for partial matches
                        for query_color in query_colors:
                            for person_color in person_colors:
                                if query_color in person_color or person_color in query_color:
                                    weighted_matches += weight * 0.7
                                    logger.info(f"Partial match on {key}: {query_color} ~ {person_color}")
                                    break
                
                # Special handling for facial features
                elif key == 'facial_features':
                    # Split features into individual terms
                    query_features = set(f.strip() for f in query_val.replace(' and ', ',').split(','))
                    person_features = set(f.strip() for f in person_val.replace(' and ', ',').split(','))
                    
                    # Check for partial matches
                    has_match = False
                    for query_feature in query_features:
                        for person_feature in person_features:
                            if query_feature in person_feature or person_feature in query_feature:
                                has_match = True
                                break
                        if has_match:
                            break
                    
                    if has_match:
                        weighted_matches += weight
                        logger.info(f"Match on facial features: {query_features} ~ {person_features}")
                    else:
                        weighted_matches += weight * 0.3
                        logger.info(f"Partial match on facial features: {query_features} ~ {person_features}")
                
                # Check for partial matches with more lenient comparison for other attributes
                elif (query_val in person_val or 
                      person_val in query_val or 
                      any(word in person_val.split() for word in query_val.split())):
                    weighted_matches += weight
                    logger.info(f"Match on {key}: {query_val} ~ {person_val}")
                elif key in ['clothing_top', 'clothing_bottom']:
                    # Special handling for clothing - check color and type separately
                    color_key = f"{key}_color"
                    if color_key in query_json and color_key in person_json:
                        query_color = str(query_json[color_key]).lower()
                        person_color = str(person_json[color_key]).lower()
                        
                        # Check for color variations
                        query_colors = set([query_color])
                        person_colors = set([person_color])
                        for base_color, variations in color_variations.items():
                            if base_color in query_color:
                                query_colors.update(variations)
                            if base_color in person_color:
                                person_colors.update(variations)
                        
                        if query_colors & person_colors:
                            weighted_matches += weight * 0.7
                            logger.info(f"Match on {color_key}: {query_colors} ~ {person_colors}")
                    
                    # Check clothing type
                    if query_val in person_val or person_val in query_val:
                        weighted_matches += weight * 0.3
                        logger.info(f"Match on {key}: {query_val} ~ {person_val}")
        
        # Calculate final similarity score (0-1)
        if weighted_total == 0:
            return 0
        similarity = weighted_matches / weighted_total
        
        # Boost score if all queried attributes match
        if weighted_matches == weighted_total:
            similarity = min(1.0, similarity * 1.2)
            
        logger.info(f"Final similarity score: {similarity:.2f}")
        return similarity
        
    except Exception as e:
        logger.error(f"Error calculating similarity: {e}")
        return 0

def find_similar_people(user_description: str, top_k=3) -> List[Dict[str, Any]]:
    """Find similar people based on text description."""
    try:
        logger.info(f"Searching for: {user_description}")
        
        # Convert query to structured JSON
        query_json = query_to_structured_json(user_description)
        if not query_json:
            logger.error("Could not parse query into structured JSON")
            return []

        # Load database
        db = load_database()
        if not db or "people" not in db:
            logger.error("Database is empty or invalid")
            return []
        
        logger.info(f"Database loaded with {len(db['people'])} people")
        
        # Calculate similarities for each person
        similarities = []
        for person in db["people"]:
            if "description" not in person:
                logger.warning(f"Person missing description: {person.get('id', 'unknown')}")
                continue
                
            similarity = calculate_similarity(query_json, person["description"])
            logger.info(f"Person {person.get('id', 'unknown')} similarity: {similarity}")
            similarities.append((person, similarity))
        
        # Sort by similarity (descending)
        similarities.sort(key=lambda x: x[1], reverse=True)
        
        # Take top k results
        top_results = similarities[:top_k]
        
        # Process results
        matches = []
        for person, similarity in top_results:
            try:
                # Convert similarity to percentage (0-100%)
                similarity_score = max(0, min(100, similarity * 100))
                
                # Load and encode image
                image_data = None
                image_path = person["metadata"].get("image_path", "")
                if image_path and os.path.exists(image_path):
                    try:
                        with open(image_path, "rb") as img_file:
                            image_data = base64.b64encode(img_file.read()).decode("utf-8")
                    except Exception as e:
                        logger.error(f"Error loading image {image_path}: {e}")
                
                matches.append({
                    "description": person["description"],
                    "metadata": person["metadata"],
                    "similarity": similarity_score,
                    "image_data": image_data
                })
                logger.info(f"Added match with similarity {similarity_score}%")
            except Exception as e:
                logger.error(f"Error processing match: {e}")
                continue

        logger.info(f"Found {len(matches)} matches")
        return matches
    except Exception as e:
        logger.error(f"Error in find_similar_people: {e}")
        return []
