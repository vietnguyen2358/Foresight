import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Path to the people_database.json file in the backend directory
    const filePath = path.join(process.cwd(), '../../backend/people_database.json');
    
    // Read the file
    const fileContents = fs.readFileSync(filePath, 'utf8');
    
    // Parse the JSON
    const data = JSON.parse(fileContents);
    
    // Return the data as JSON
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error reading people_database.json:', error);
    return NextResponse.json(
      { error: 'Failed to load database' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // Get the person data from the request body
    const personData = await request.json();
    
    // Path to the people_database.json file in the backend directory
    const filePath = path.join(process.cwd(), '../../backend/people_database.json');
    
    // Read the current database
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const database = JSON.parse(fileContents);
    
    // Check for duplicates using a similarity-based approach
    let isDuplicate = false;
    
    for (const person of database.people) {
      // Count matching fields to determine similarity
      let matchingFields = 0;
      let totalFields = 0;
      
      // List of fields to compare
      const fieldsToCompare = [
        "gender", "age_group", "hair_style", "hair_color", 
        "skin_tone", "facial_features", "accessories",
        "clothing_top", "clothing_top_color", "clothing_top_pattern",
        "clothing_bottom", "clothing_bottom_color", "clothing_bottom_pattern",
        "footwear", "footwear_color"
      ];
      
      // Count matching fields
      for (const field of fieldsToCompare) {
        if (field in person.description || field in personData.description) {
          totalFields++;
          if (person.description[field] === personData.description[field] && person.description[field] !== undefined) {
            matchingFields++;
          }
        }
      }
      
      // Check if timestamps are within 5 minutes of each other
      const timeDiff = Math.abs(
        new Date(person.metadata.timestamp).getTime() - 
        new Date(personData.metadata.timestamp).getTime()
      );
      
      // Check if camera IDs match
      const cameraMatch = person.metadata.camera_id === personData.metadata.camera_id;
      
      // Calculate similarity percentage
      const similarity = totalFields > 0 ? matchingFields / totalFields : 0;
      
      // If high similarity (>80%) and same camera or close in time, consider it a duplicate
      if (similarity > 0.8 && (cameraMatch || timeDiff < 300000)) { // 5 minutes in milliseconds
        console.log(`Duplicate person detected with ${similarity * 100}% similarity`);
        isDuplicate = true;
        break;
      }
    }
    
    if (isDuplicate) {
      return NextResponse.json({ duplicate: true });
    }
    
    // Add the new person to the database
    database.people.push(personData);
    
    // Write the updated database to the file
    fs.writeFileSync(filePath, JSON.stringify(database, null, 2), 'utf8');
    
    // Return success
    return NextResponse.json({ success: true, duplicate: false });
  } catch (error) {
    console.error('Error updating people_database.json:', error);
    return NextResponse.json(
      { error: 'Failed to update database' },
      { status: 500 }
    );
  }
} 