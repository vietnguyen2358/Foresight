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
        
        # Handle gender-specific queries
        gender_terms = {
            'female': ['female', 'woman', 'girl', 'lady', 'women', 'girls', 'ladies', 'she', 'her'],
            'male': ['male', 'man', 'boy', 'guy', 'men', 'boys', 'guys', 'he', 'him', 'his']
        }
        
        # Check for gender terms in the query
        detected_gender = None
        for gender, terms in gender_terms.items():
            if any(term in query for term in terms):
                detected_gender = gender
                # If the query doesn't explicitly mention gender in the structured format,
                # add it to ensure proper filtering
                if "gender" not in query:
                    query = f"Find a {gender} {query}"
                break
        
        # Handle "with" queries for hair color
        hair_colors = ['blonde', 'blond', 'black', 'brown', 'red', 'white', 'gray', 'grey']
        if "with" in query:
            parts = query.split("with")
            if len(parts) > 1:
                hair_part = parts[1].strip()
                for color in hair_colors:
                    if color in hair_part:
                        # Create a structured query focusing on the hair color
                        query = f"Find a person with {color} hair {parts[0].strip()}"
                        break
        
        # Handle "wearing" queries
        if "wearing" in query:
            # Extract color and clothing type after "wearing"
            parts = query.split("wearing")
            if len(parts) > 1:
                clothing_part = parts[1].strip()
                # Check if it's a color query
                colors = ["grey", "gray", "black", "white", "red", "blue", "green", "yellow", "brown", "light blue", "dark blue"]
                clothing_types = ["hoodie", "shirt", "t-shirt", "jacket", "coat", "sweater"]
                
                # Extract color and clothing type
                found_color = None
                found_type = None
                
                for color in colors:
                    if color in clothing_part:
                        found_color = color
                        break
                
                for clothing_type in clothing_types:
                    if clothing_type in clothing_part:
                        found_type = clothing_type
                        break
                
                if found_color and found_type:
                    # Create a structured query focusing on the clothing
                    query = f"Find a person wearing a {found_color} {found_type} {parts[0].strip()}"
        
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
            
            # If we detected a gender but it's not in the result, add it
            if detected_gender and ('gender' not in result or not result['gender']):
                result['gender'] = detected_gender
                logger.info(f"Added detected gender '{detected_gender}' to query result")
            
            return result
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing JSON response: {e}")
            logger.error(f"Response text: {response_text}")
            return {}
    except Exception as e:
        logger.error(f"Error in query_to_structured_json: {e}")
        return {}

def calculate_similarity(query_json: Dict[str, Any], person_json: Dict[str, Any]) -> float:
    """Calculate similarity between query and person description."""
    try:
        # Define weights for different attributes
        weights = {
            'gender': 3.0,  # Increased weight for gender
            'age_group': 2.0,  # Increased weight for age group
            'child_context': 1.5,  # New weight for child context
            'height_estimate': 1.0,  # New weight for height
            'build_type': 1.0,  # New weight for build
            'ethnicity': 1.0,
            'skin_tone': 1.0,
            'hair_style': 1.2,
            'hair_color': 2.5,  # Increased weight for hair color
            'facial_features': 3.0,  # Increased weight for facial features to prioritize beard/mustache
            'clothing_top': 2.0,  # Increased weight for clothing type
            'clothing_top_color': 2.5,  # Increased weight for clothing color
            'clothing_bottom': 1.5,
            'clothing_bottom_color': 1.5,
            'footwear': 1.0,
            'accessories': 1.0,
            'pose': 1.0,
            'location_context': 1.0
        }
        
        # Color variations mapping
        color_variations = {
            'grey': ['gray', 'grey', 'silver'],
            'gray': ['grey', 'gray', 'silver'],
            'black': ['black', 'dark', 'navy'],
            'white': ['white', 'light', 'cream'],
            'red': ['red', 'maroon', 'burgundy'],
            'blue': ['blue', 'navy', 'light blue', 'sky blue', 'azure'],
            'green': ['green', 'olive', 'emerald'],
            'yellow': ['yellow', 'gold', 'amber'],
            'brown': ['brown', 'tan', 'beige']
        }
        
        # Gender variations mapping
        gender_variations = {
            'female': ['female', 'woman', 'girl', 'lady', 'women', 'girls', 'ladies'],
            'male': ['male', 'man', 'boy', 'guy', 'men', 'boys', 'guys'],
            'other': ['other', 'non-binary', 'nonbinary', 'transgender', 'trans']
        }
        
        # Age group variations mapping
        age_group_variations = {
            'child': ['child', 'kid', 'children', 'kids', 'young', 'little', 'small'],
            'teen': ['teen', 'teenager', 'adolescent', 'youth', 'young adult'],
            'adult': ['adult', 'grown-up', 'grown up', 'mature', 'middle-aged'],
            'senior': ['senior', 'elderly', 'old', 'older', 'aged']
        }
        
        # Child context variations mapping
        child_context_variations = {
            'with_parent': ['with parent', 'with parents', 'with mother', 'with father', 'with guardian', 'with family'],
            'with_guardian': ['with guardian', 'with caregiver', 'with adult', 'with supervisor'],
            'alone': ['alone', 'by themselves', 'independent', 'unaccompanied'],
            'playing': ['playing', 'engaged in play', 'playing with toys', 'playing with others'],
            'learning': ['learning', 'studying', 'reading', 'in class', 'at school'],
            'with_peers': ['with peers', 'with friends', 'with other children', 'in group']
        }
        
        # Facial hair variations mapping
        facial_hair_variations = {
            'beard': ['beard', 'bearded', 'facial hair', 'facial-hair', 'full beard'],
            'mustache': ['mustache', 'moustache', 'stache', 'mustachio'],
            'goatee': ['goatee', 'goatee beard', 'chin beard'],
            'stubble': ['stubble', '5 o\'clock shadow', 'facial stubble', 'light beard'],
            'clean-shaven': ['clean-shaven', 'clean shaven', 'no facial hair', 'no beard'],
            'beard_length': ['short beard', 'medium beard', 'long beard', 'full beard'],
            'beard_style': ['trimmed', 'neat', 'well-groomed', 'unkempt', 'messy'],
            'beard_color': ['black beard', 'brown beard', 'gray beard', 'white beard', 'colored beard']
        }
        
        weighted_matches = 0
        weighted_total = 0
        
        # Check if the query contains child-related terms
        query_contains_child_terms = False
        if 'age_group' in query_json:
            query_age = str(query_json['age_group']).lower()
            if any(term in query_age for term in ['child', 'kid', 'children', 'kids']):
                query_contains_child_terms = True
        
        # Check if the person is a child
        person_is_child = False
        if 'age_group' in person_json:
            person_age = str(person_json['age_group']).lower()
            if person_age == 'child':
                person_is_child = True
        
        # Check if the query contains facial hair terms
        query_contains_facial_hair = False
        if 'facial_features' in query_json:
            query_features = str(query_json['facial_features']).lower()
            for feature, variations in facial_hair_variations.items():
                if any(term in query_features for term in variations):
                    query_contains_facial_hair = True
                    break
        
        # Check if the person has facial hair
        person_has_facial_hair = False
        if 'facial_features' in person_json:
            person_features = str(person_json['facial_features']).lower()
            for feature, variations in facial_hair_variations.items():
                if any(term in person_features for term in variations):
                    person_has_facial_hair = True
                    break
        
        # If query contains facial hair terms but person doesn't have facial hair, return 0
        if query_contains_facial_hair and not person_has_facial_hair:
            logger.info(f"Query contains facial hair terms but person doesn't have facial hair")
            return 0
        
        for key in query_json:
            if key in person_json:
                weight = weights.get(key, 1.0)
                weighted_total += weight
                
                # Get the values to compare
                query_val = str(query_json[key]).lower()
                person_val = str(person_json[key]).lower()
                
                # Special handling for gender - strict matching
                if key == 'gender':
                    # Check for exact match first
                    if query_val == person_val:
                        weighted_matches += weight
                        logger.info(f"Exact match on gender: {query_val} = {person_val}")
                    else:
                        # Check for variations
                        query_genders = set([query_val])
                        person_genders = set([person_val])
                        
                        # Add variations
                        for base_gender, variations in gender_variations.items():
                            if base_gender in query_val:
                                query_genders.update(variations)
                            if base_gender in person_val:
                                person_genders.update(variations)
                        
                        # Check for matches including variations
                        if query_genders & person_genders:  # If there's any intersection
                            weighted_matches += weight
                            logger.info(f"Match on gender with variations: {query_genders} ~ {person_genders}")
                        else:
                            logger.info(f"No match on gender: {query_val} != {person_val}")
                            # Return 0 similarity if gender doesn't match (strict matching)
                            return 0
                
                # Special handling for age_group - strict matching for child-related queries
                elif key == 'age_group':
                    # Check for exact match first
                    if query_val == person_val:
                        weighted_matches += weight
                        logger.info(f"Exact match on age_group: {query_val} = {person_val}")
                    else:
                        # Check for variations
                        query_ages = set([query_val])
                        person_ages = set([person_val])
                        
                        # Add variations
                        for base_age, variations in age_group_variations.items():
                            if base_age in query_val:
                                query_ages.update(variations)
                            if base_age in person_val:
                                person_ages.update(variations)
                        
                        # Check for matches including variations
                        if query_ages & person_ages:  # If there's any intersection
                            weighted_matches += weight
                            logger.info(f"Match on age_group with variations: {query_ages} ~ {person_ages}")
                        else:
                            # If query contains child-related terms and person is not a child, return 0
                            if query_contains_child_terms and not person_is_child:
                                logger.info(f"Query contains child terms but person is not a child: {query_val} != {person_val}")
                                return 0
                            # Check for partial matches
                            for query_age in query_ages:
                                for person_age in person_ages:
                                    if query_age in person_age or person_age in query_age:
                                        weighted_matches += weight * 0.7
                                        logger.info(f"Partial match on age_group: {query_age} ~ {person_age}")
                                        break
                
                # Special handling for hair color
                elif key == 'hair_color':
                    # Check for exact match first
                    if query_val == person_val:
                        weighted_matches += weight
                        logger.info(f"Exact match on hair color: {query_val} = {person_val}")
                    else:
                        # Check for variations
                        query_colors = set([query_val])
                        person_colors = set([person_val])
                        
                        # Add variations
                        for base_color, variations in color_variations.items():
                            if base_color in query_val:
                                query_colors.update(variations)
                            if base_color in person_val:
                                person_colors.update(variations)
                        
                        # Check for matches including variations
                        if query_colors & person_colors:  # If there's any intersection
                            weighted_matches += weight
                            logger.info(f"Match on hair color with variations: {query_colors} ~ {person_colors}")
                        else:
                            # Check for partial matches
                            for query_color in query_colors:
                                for person_color in person_colors:
                                    if query_color in person_color or person_color in query_color:
                                        weighted_matches += weight * 0.7
                                        logger.info(f"Partial match on hair color: {query_color} ~ {person_color}")
                                        break
                
                # Special handling for facial features (including facial hair)
                elif key == 'facial_features':
                    # Check for exact match first
                    if query_val == person_val:
                        weighted_matches += weight
                        logger.info(f"Exact match on facial features: {query_val} = {person_val}")
                    else:
                        # Check for variations
                        query_features = set([query_val])
                        person_features = set([person_val])
                        
                        # Add facial hair variations
                        for base_feature, variations in facial_hair_variations.items():
                            if base_feature in query_val:
                                query_features.update(variations)
                            if base_feature in person_val:
                                person_features.update(variations)
                        
                        # Check for matches including variations
                        if query_features & person_features:  # If there's any intersection
                            weighted_matches += weight
                            logger.info(f"Match on facial features with variations: {query_features} ~ {person_features}")
                        else:
                            # Check for partial matches
                            for query_feature in query_features:
                                for person_feature in person_features:
                                    if query_feature in person_feature or person_feature in query_feature:
                                        weighted_matches += weight * 0.8
                                        logger.info(f"Partial match on facial features: {query_feature} ~ {person_feature}")
                                        break
                
                # Special handling for clothing colors
                elif key in ['clothing_top_color', 'clothing_bottom_color']:
                    # Check for exact match first
                    if query_val == person_val:
                        weighted_matches += weight
                        logger.info(f"Exact match on {key}: {query_val} = {person_val}")
                    else:
                        # Check for variations
                        query_colors = set([query_val])
                        person_colors = set([person_val])
                        
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
                
                # Special handling for clothing type
                elif key in ['clothing_top', 'clothing_bottom']:
                    # Check for exact match first
                    if query_val == person_val:
                        weighted_matches += weight
                        logger.info(f"Exact match on {key}: {query_val} = {person_val}")
                    else:
                        # Check for partial matches
                        query_terms = set(query_val.split())
                        person_terms = set(person_val.split())
                        
                        # Check for intersection
                        if query_terms & person_terms:
                            weighted_matches += weight * 0.8
                            logger.info(f"Partial match on {key}: {query_terms} ~ {person_terms}")
                        else:
                            # Check for substring matches
                            if query_val in person_val or person_val in query_val:
                                weighted_matches += weight * 0.6
                                logger.info(f"Substring match on {key}: {query_val} ~ {person_val}")
                
                # Check for partial matches with more lenient comparison for other attributes
                elif (query_val in person_val or 
                      person_val in query_val or 
                      any(word in person_val.split() for word in query_val.split())):
                    weighted_matches += weight
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

def find_similar_people(user_description: str, top_k=5) -> List[Dict[str, Any]]:
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
                
                # Create match without image data
                matches.append({
                    "description": person["description"],
                    "metadata": person["metadata"],
                    "similarity": similarity_score
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

def generate_rag_response(user_query: str, matches: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Use Gemini to generate a RAG-enhanced response based on the user query and matches.
    This function takes the top matches from our database and uses Gemini to provide
    a more natural language response that explains why these matches were found.
    """
    try:
        if not matches:
            return {
                "response": "I couldn't find any matches for your search. Try using more general terms or fewer specific details.",
                "matches": []
            }
        
        # Format matches for the prompt
        matches_text = ""
        for i, match in enumerate(matches):
            desc = match.get("description", {})
            metadata = match.get("metadata", {})
            similarity = match.get("similarity", 0)
            
            # Format the match as a readable string
            match_text = f"Match {i+1} (Similarity: {similarity:.1f}%):\n"
            
            # Add key attributes
            if "gender" in desc:
                match_text += f"- Gender: {desc['gender']}\n"
            if "age_group" in desc:
                match_text += f"- Age: {desc['age_group']}\n"
            if "facial_features" in desc and desc["facial_features"]:
                match_text += f"- Facial features: {desc['facial_features']}\n"
            if "hair_color" in desc:
                match_text += f"- Hair color: {desc['hair_color']}\n"
            if "clothing_top" in desc:
                match_text += f"- Wearing: {desc.get('clothing_top_color', '')} {desc['clothing_top']}\n"
            if "clothing_bottom" in desc:
                match_text += f"- Bottom: {desc.get('clothing_bottom_color', '')} {desc['clothing_bottom']}\n"
            if "location_context" in desc:
                match_text += f"- Location: {desc['location_context']}\n"
            if "camera_id" in metadata:
                match_text += f"- Camera: {metadata['camera_id']}\n"
            if "timestamp" in metadata:
                match_text += f"- Time: {metadata['timestamp']}\n"
            
            matches_text += match_text + "\n"
        
        # Create the RAG prompt
        rag_prompt = f"""
You are an AI assistant helping with a person search system. A user has searched for: "{user_query}"

The system found the following matches in the database:

{matches_text}

Based on these matches, provide a natural language response that:
1. Explains why these matches were found
2. Highlights the key similarities between the matches and the user's query
3. Mentions any notable differences or limitations
4. Suggests how the user could refine their search if needed

Keep your response concise and focused on helping the user understand the search results.
"""
        
        # Generate response using Gemini
        response = model.generate_content(rag_prompt)
        rag_response = response.text
        
        # Return both the RAG response and the original matches
        return {
            "response": rag_response,
            "matches": matches
        }
    except Exception as e:
        logger.error(f"Error generating RAG response: {e}")
        # Fall back to returning just the matches if RAG fails
        return {
            "response": "I found some matches for your search, but couldn't generate a detailed explanation.",
            "matches": matches
        }
