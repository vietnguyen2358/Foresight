// API service for backend communication

// API base URL
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Log the API base URL for debugging
console.log("API_BASE_URL:", API_BASE_URL);

// Health check function
export async function checkServerHealth(): Promise<boolean> {
  try {
    console.log("Checking server health...");
    const response = await fetch(`${API_BASE_URL}/health`);
    const isHealthy = response.ok;
    console.log(`Server health check: ${isHealthy ? "OK" : "FAILED"} (${response.status} ${response.statusText})`);
    return isHealthy;
  } catch (error) {
    console.error("Server health check error:", error);
    return false;
  }
}

// Types
export interface Detection {
  id: string;
  type: string;
  confidence: number;
  timestamp: string;
  image?: string;
  camera_id?: string;
}

export interface PersonDescription {
  appearance?: string;
  clothing?: string;
  accessories?: string;
  actions?: string;
  location?: string;
  timestamp?: string;
  camera_id?: string;
  image?: string;
  cropped_image?: string;
  boundingBox?: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

export interface Match {
  description: {
    gender?: string;
    age_group?: string;
    ethnicity?: string;
    skin_tone?: string;
    hair_style?: string;
    hair_color?: string;
    facial_features?: string;
    clothing_top?: string;
    clothing_top_color?: string;
    clothing_top_pattern?: string;
    clothing_bottom?: string;
    clothing_bottom_color?: string;
    clothing_bottom_pattern?: string;
    accessories?: string;
    bag_type?: string;
    bag_color?: string;
    location_context?: string;
    pose?: string;
    [key: string]: any;
  };
  metadata: {
    timestamp?: string;
    camera_id?: string;
    camera_location?: string;
    image_path?: string;
    explanation?: string;
    [key: string]: any;
  };
  similarity: number;
  image?: string;
  image_data?: string;
  highlights?: string[];
  explanation?: string;
  match_details?: any;
}

export interface SearchResult {
  matches: Match[];
  count?: number;
  message?: string;
  suggestions?: string[];
  rag_response?: string;
}

export interface ChatResponse {
  response: string;
}

export interface FrameResponse {
  detections: Detection[];
  description: string;
  timestamp: string;
  person_crops: {
    id: string;
    crop: string;
    description: any;
  }[];
  amber_alert?: {
    match: boolean;
    alert: {
      id: string;
      timestamp: string;
      location: string;
      description: any;
      alert_message: string;
    };
    score: number;
  };
}

// Add the interface for person search chat
export interface PersonSearchChatRequest {
  query: string;
  conversation_history?: Array<{role: string, content: string}>;
  include_raw_database?: boolean;
}

export interface PersonSearchChatResponse {
  response: string;
  suggested_searches: string[];
  database_stats: Record<string, any>;
  matches: Array<{
    id: string;
    camera_id: string;
    camera_location: string;
    description: Record<string, any>;
    score: number;
    match_reasons: string[];
  }>;
}

// API functions
export async function uploadImage(file: File, is_video: boolean = false, camera_id?: string): Promise<{
  detections: Detection[];
  descriptions: PersonDescription[];
}> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('is_video', String(is_video));
  
  // Add camera_id if provided
  if (camera_id) {
    formData.append('camera_id', camera_id);
  }

  const maxRetries = 3;
  let retryCount = 0;
  let lastError: Error | null = null;

  while (retryCount < maxRetries) {
    try {
      console.log(`Uploading file to server (attempt ${retryCount + 1}/${maxRetries}):`, file.name, camera_id ? `from camera: ${camera_id}` : '')
      
      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error:', response.status, errorText);
        throw new Error(`Server error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log('Server response:', data);

      if (!data || !Array.isArray(data.descriptions)) {
        console.error('Invalid response format:', data);
        throw new Error('Invalid response format from server');
      }

      return {
        detections: data.detections || [],
        descriptions: data.descriptions || [],
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Upload error (attempt ${retryCount + 1}/${maxRetries}):`, error);
      
      // If this is not the last attempt, wait before retrying
      if (retryCount < maxRetries - 1) {
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      retryCount++;
    }
  }

  // If we've exhausted all retries, throw the last error
  throw lastError || new Error('Failed to upload image after multiple attempts');
}

export function uploadImageStream(
  file: File, 
  is_video: boolean = false,
  onPerson: (detection: Detection, description: PersonDescription) => void,
  onComplete: (count: number) => void,
  onError: (error: string) => void
): () => void {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('is_video', String(is_video));

  const controller = new AbortController();
  const signal = controller.signal;

  fetch(`${API_BASE_URL}/upload_stream`, {
    method: 'POST',
    body: formData,
    signal
  })
    .then(response => {
      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No reader available');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      function processChunk(chunk: string): void {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const data = JSON.parse(line);
            
            if (data.type === 'person') {
              onPerson(data.data.detection, data.data.description);
            } else if (data.type === 'complete') {
              onComplete(data.count);
            } else if (data.type === 'error') {
              onError(data.message);
            }
          } catch (e) {
            console.error('Error parsing JSON:', e);
          }
        }
      }

      function pump(): Promise<void> {
        return reader!.read().then(({ done, value }) => {
          if (done) {
            if (buffer) {
              processChunk(buffer);
            }
            return;
          }

          const chunk = decoder.decode(value, { stream: true });
          processChunk(chunk);
          return pump();
        });
      }

      return pump();
    })
    .catch(error => {
      console.error('Error in stream:', error);
      onError(error.message);
    });

  // Return a function to abort the stream
  return () => controller.abort();
}

export async function searchPeople(description: string): Promise<SearchResult> {
  try {
    console.log("Searching for people with description:", description);
    
    // Log that we're using Gemini for natural language processing
    console.log("Using Gemini direct database search processing");
    
    // Additional parameters to ensure we get the best structured search results
    const searchParams = {
      description, 
      use_gemini: true,
      include_camera_location: true,
      include_match_highlights: true,
      structured_json: true,
      include_rag_response: true,
      use_direct_search: true, // Enable the direct database search with Gemini
      top_k: 5 // Number of results to return
    };
    
    const response = await fetch(`${API_BASE_URL}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(searchParams),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Search API error:", response.status, errorText);
      throw new Error(`Search request failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log("Search API response:", data);
    
    if (!data || !Array.isArray(data.matches)) {
      console.error("Invalid response format from search API");
      return { matches: [] };
    }
    
    // Process the matches, ensuring camera location is included
    const matches = data.matches.map((match: any) => {
      // Ensure we have metadata
      const metadata = match.metadata || {};
      
      // Get camera location from either the response or our local mapping
      const cameraLocation = metadata.camera_location || 
                            getCameraLocation(metadata.camera_id) || 
                            "Unknown location";
      
      // Extract explanation if available from direct search
      const explanation = match.explanation || "";
      
      // Extract match highlights if available
      const highlights = match.highlights || [];
      
      // Get match details if available
      const matchDetails = match.match_details || {};
      
      // Prepare the complete match object with all necessary fields
      return {
        description: match.description || {},
        metadata: {
          ...metadata,
          camera_location: cameraLocation,
          explanation: explanation  // Add explanation field to metadata
        },
        similarity: match.similarity || 0,
        image: metadata.image_path ? `${API_BASE_URL}/${metadata.image_path}` : undefined,
        image_data: match.image_data,
        highlights: highlights,
        match_details: matchDetails,
        explanation: explanation  // Also add at top level for easy access
      };
    });
    
    // Process response message and RAG response
    const message = data.message || "";
    const ragResponse = data.rag_response || data.response || "";
    const suggestions = data.suggestions || [];
    
    return {
      matches,
      count: data.count || matches.length,
      message: message,
      suggestions: suggestions,
      rag_response: ragResponse
    };
  } catch (error) {
    console.error("Error in searchPeople:", error);
    return { 
      matches: [],
      message: "Error searching for people. Please try again.",
      rag_response: "I encountered an error while searching. Please try a different query or try again later."
    };
  }
}

// Helper function to get camera location from camera ID
function getCameraLocation(cameraId: string | undefined): string {
  if (!cameraId) return "Unknown";
  
  // Map camera IDs to locations - this could be expanded or moved to a configuration file
  const cameraLocations: {[key: string]: string} = {
    "SF-MIS-001": "Mission District - 16th Street",
    "SF-MIS-002": "Mission District - 24th Street",
    "SF-MIS-003": "Mission District - Valencia Street",
    "SF-MIS-004": "Mission District - Dolores Park",
    "SF-MIS-005": "Mission District - Bryant Street",
    "SF-MIS-006": "Mission District - Folsom Street",
    "SF-MIS-007": "Mission District - Guerrero Street",
    "SF-MIS-008": "Mission District - South Van Ness Avenue",
    "SF-FID-001": "Financial District - Market Street",
    "SF-FID-002": "Financial District - Montgomery Street",
    "SF-FID-003": "Financial District - California Street",
    "SF-FID-004": "Financial District - Embarcadero",
    "SF-NOB-001": "Nob Hill - Powell Street",
    "SF-NOB-002": "Nob Hill - California Street",
    "SF-CHI-001": "Chinatown - Grant Avenue",
    "SF-CHI-002": "Chinatown - Stockton Street"
  };
  
  return cameraLocations[cameraId] || `Location for ${cameraId}`;
}

export async function chatWithAI(messages: { role: string; content: string }[]): Promise<ChatResponse> {
  try {
    console.log("Sending chat request to backend:", messages);
    
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Chat API error:", response.status, errorText);
      throw new Error(`Failed to chat with AI: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    console.log("Chat API response:", data);
    
    if (!data || !data.response) {
      console.error("Invalid chat response format:", data);
      throw new Error("Invalid response format from chat API");
    }
    
    return data;
  } catch (error) {
    console.error("Error in chatWithAI:", error);
    throw error;
  }
}

// Mock data for development
export const mockDetections: Detection[] = [
  {
    id: "det1",
    type: "Person",
    confidence: 0.95,
    timestamp: new Date().toLocaleTimeString(),
    image: "https://picsum.photos/seed/person1/200/150"
  },
  {
    id: "det2",
    type: "Vehicle",
    confidence: 0.88,
    timestamp: new Date().toLocaleTimeString(),
    image: "https://picsum.photos/seed/vehicle1/200/150"
  },
  {
    id: "det3",
    type: "Person",
    confidence: 0.92,
    timestamp: new Date().toLocaleTimeString(),
    image: "https://picsum.photos/seed/person2/200/150"
  }
];

export const mockPersonDescriptions: PersonDescription[] = [
  {
    appearance: "Male, 30-40 years old, average build",
    clothing: "Blue jacket, dark jeans",
    accessories: "Black backpack, silver watch",
    actions: "Walking quickly, looking around frequently",
    location: "Market Street",
    timestamp: new Date().toLocaleTimeString(),
    image: "https://picsum.photos/seed/person1/200/150"
  },
  {
    appearance: "Female, 20-30 years old, athletic build",
    clothing: "Red hoodie, black leggings",
    accessories: "White headphones, fitness tracker",
    actions: "Jogging, checking phone occasionally",
    location: "Golden Gate Park",
    timestamp: new Date().toLocaleTimeString(),
    image: "https://picsum.photos/seed/person2/200/150"
  }
];

// Add the person search chat function
export async function personSearchChat(request: PersonSearchChatRequest): Promise<PersonSearchChatResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/person_search_chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      console.error('Error in person search chat response:', await response.text());
      throw new Error(`Error in person search chat: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as PersonSearchChatResponse;
    console.log('Person search chat response:', data);
    return data;
  } catch (error) {
    console.error('Error in person search chat:', error);
    throw error;
  }
} 