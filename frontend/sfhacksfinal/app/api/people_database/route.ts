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
    // Get the updated database from the request body
    const updatedDatabase = await request.json();
    
    // Path to the people_database.json file in the backend directory
    const filePath = path.join(process.cwd(), '../../backend/people_database.json');
    
    // Write the updated database to the file
    fs.writeFileSync(filePath, JSON.stringify(updatedDatabase, null, 2), 'utf8');
    
    // Return success
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating people_database.json:', error);
    return NextResponse.json(
      { error: 'Failed to update database' },
      { status: 500 }
    );
  }
} 