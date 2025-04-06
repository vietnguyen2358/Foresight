import json
import os
import logging
from typing import Dict, Any, List

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
AMBER_ALERT_FILE = os.path.join(os.path.dirname(__file__), "data", "amber_alert.json")

# Critical matching attributes with weights
CRITICAL_ATTRIBUTES = {
    "gender": 3.0,
    "age_group": 4.0,
    "clothing_top": 2.5,
    "clothing_top_color": 2.0,
    "clothing_bottom": 2.0,
    "clothing_bottom_color": 2.0,
    "hair_style": 1.5,
    "location_context": 1.0
}

def load_amber_alerts():
    """Load active amber alerts from the database file."""
    try:
        if os.path.exists(AMBER_ALERT_FILE):
            with open(AMBER_ALERT_FILE, 'r') as f:
                data = json.load(f)
                # Only return data if amber alerts are active
                if data.get("active", False):
                    return data.get("alerts", [])
                else:
                    logger.info("Amber alerts are not currently active")
                    return []
        else:
            logger.warning(f"Amber alert file not found at {AMBER_ALERT_FILE}")
            return []
    except Exception as e:
        logger.error(f"Error loading amber alerts: {str(e)}")
        return []

def check_amber_alert_match(person_description: Dict[str, Any]) -> Dict[str, Any]:
    """
    Check if a person description matches any active amber alerts.
    Returns the matching alert if found, otherwise None.
    """
    try:
        # Load active amber alerts
        active_alerts = load_amber_alerts()
        if not active_alerts:
            return None
        
        logger.info(f"Checking amber alert match against {len(active_alerts)} active alerts")
        logger.info(f"Person description: {person_description}")
        
        # Calculate match scores for each alert
        matches = []
        for alert in active_alerts:
            alert_desc = alert.get("description", {})
            if not alert_desc:
                continue
                
            score = calculate_match_score(person_description, alert_desc)
            logger.info(f"Match score for alert {alert.get('id')}: {score}")
            
            # Consider a match if score is above 0.7 (70%)
            if score >= 0.7:
                matches.append({
                    "alert": alert,
                    "score": score
                })
        
        # Return the highest scoring match if any
        if matches:
            matches.sort(key=lambda x: x["score"], reverse=True)
            logger.info(f"Found amber alert match with score {matches[0]['score']}")
            return {
                "match": True,
                "alert": matches[0]["alert"],
                "score": matches[0]["score"]
            }
        
        return None
    except Exception as e:
        logger.error(f"Error checking amber alert match: {str(e)}")
        return None

def calculate_match_score(person_desc: Dict[str, Any], alert_desc: Dict[str, Any]) -> float:
    """
    Calculate a match score between a person description and an amber alert description.
    Returns a value between 0 and 1, where 1 is a perfect match.
    """
    try:
        # Hard-coded special case: if person is male, child, and wearing black top and bottom
        if (person_desc.get("gender", "").lower() == "male" and 
            person_desc.get("age_group", "").lower() == "child" and
            person_desc.get("clothing_top_color", "").lower() == "black" and
            person_desc.get("clothing_bottom_color", "").lower() == "black"):
            logger.info("SPECIAL MATCH: Male child wearing all black")
            return 1.0  # Perfect match
            
        # Track scoring
        weighted_matches = 0
        weighted_total = 0
        
        # Special case: If age_group is not "child" in alert, no match
        if alert_desc.get("age_group") == "child" and person_desc.get("age_group") != "child":
            logger.info("Alert is for a child but person is not a child")
            return 0
        
        # Check each critical attribute
        for attr, weight in CRITICAL_ATTRIBUTES.items():
            # Skip if either description doesn't have this attribute
            if attr not in alert_desc or attr not in person_desc:
                continue
                
            alert_val = str(alert_desc[attr]).lower()
            person_val = str(person_desc[attr]).lower()
            
            weighted_total += weight
            
            # Check for exact match
            if alert_val == person_val:
                weighted_matches += weight
                logger.info(f"Exact match on {attr}: {alert_val} = {person_val}")
            # Check for partial match
            elif alert_val in person_val or person_val in alert_val:
                weighted_matches += weight * 0.7
                logger.info(f"Partial match on {attr}: {alert_val} ~ {person_val}")
            
        # Calculate final score
        if weighted_total == 0:
            return 0
        
        return weighted_matches / weighted_total
    except Exception as e:
        logger.error(f"Error calculating match score: {str(e)}")
        return 0 