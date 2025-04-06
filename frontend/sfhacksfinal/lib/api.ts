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

export interface SearchResult {
  matches: Array<{
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
    };
    metadata: {
      timestamp: string;
      camera_id?: string;
      location?: string;
    };
    similarity: number;
    imageData?: string;
  }>;
}

export interface ChatResponse {
  response: string;
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
    
    const response = await fetch(`${API_BASE_URL}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ description }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Search API error:", response.status, errorText);
      throw new Error(`Search request failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log("Search API response:", data);
    
    if (!data || !data.matches) {
      console.error("Invalid search response format:", data);
      return { matches: [] };
    }
    
    return {
      matches: data.matches.map((match: any) => ({
        description: match.description,
        metadata: match.metadata,
        similarity: match.similarity,
        imageData: match.image_data,
      }))
    };
  } catch (error) {
    console.error('Error searching people:', error);
    return { matches: [] };
  }
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