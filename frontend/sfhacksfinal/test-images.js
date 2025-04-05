// Simple script to test image loading from the backend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

console.log("Testing image loading from:", API_BASE_URL);

// Test a few common image paths
const testPaths = [
  '/images/sample.jpg',
  '/uploads/sample.jpg',
  '/static/sample.jpg',
  '/media/sample.jpg',
  '/assets/sample.jpg'
];

async function testImagePath(path) {
  const url = `${API_BASE_URL}${path}`;
  console.log(`Testing URL: ${url}`);
  
  try {
    const response = await fetch(url);
    console.log(`Status for ${path}: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      console.log(`✅ Image at ${path} is accessible`);
    } else {
      console.log(`❌ Image at ${path} is NOT accessible`);
    }
  } catch (error) {
    console.error(`Error testing ${path}:`, error.message);
  }
}

async function runTests() {
  console.log("Starting image tests...");
  
  for (const path of testPaths) {
    await testImagePath(path);
  }
  
  console.log("Tests completed.");
}

runTests(); 