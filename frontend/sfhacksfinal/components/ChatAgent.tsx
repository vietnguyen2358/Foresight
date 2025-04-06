"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, User, Bot, Loader2, Maximize2, X } from "lucide-react"
import { Card } from "@/components/ui/card"
import { searchPeople, chatWithAI, type Detection, type PersonDescription, API_BASE_URL, checkServerHealth } from "@/lib/api"
import { motion, AnimatePresence } from "framer-motion"
import { useCamera, type Camera } from "@/lib/CameraContext"
import type { SearchResult } from "@/lib/api"

type Message = {
  role: "user" | "assistant"
  content: string
}

// Add type declaration for window.zoomToCamera
declare global {
  interface Window {
    zoomToCamera?: (cameraId: string) => void;
  }
}

export default function ChatAgent() {
  const { selectedCamera, setSelectedCamera, cameras } = useCamera()
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm your AI assistant. I can help you search for people and chat with you. What would you like to know?",
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      const chatContainer = chatContainerRef.current
      if (chatContainer) {
        requestAnimationFrame(() => {
          chatContainer.scrollTo({
            top: chatContainer.scrollHeight,
            behavior: "smooth"
          })
        })
      }
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading])

  useEffect(() => {
    scrollToBottom()
  }, [])

  // Add a useEffect hook that depends on the selectedCamera state
  useEffect(() => {
    if (selectedCamera) {
      console.log("Selected camera changed in ChatAgent:", selectedCamera);
      
      // Try to use the zoomToCamera method if available
      setTimeout(() => {
        // @ts-ignore
        if (window.zoomToCamera) {
          console.log("Using zoomToCamera method from ChatAgent");
          // @ts-ignore
          window.zoomToCamera(selectedCamera);
        } else {
          console.log("zoomToCamera method not available from ChatAgent");
        }
      }, 500);
    }
  }, [selectedCamera]);

  const formatSearchResults = (results: SearchResult): string => {
    if (!results.matches || results.matches.length === 0) {
      return "❌ No matches found in the camera feeds. Try describing the person differently or with fewer details."
    }
    
    const firstMatch = results.matches[0];
    const description = firstMatch.description;
    const cameraId = firstMatch.camera_id;
    const similarity = (firstMatch.similarity * 100).toFixed(1);
    
    let resultText = `🎯 Match Found (${similarity}% similarity)\n\n`;
    
    // Add camera information if available
    if (cameraId) {
      resultText += `📍 Location: Camera ${cameraId}\n\n`;
    }
    
    // Add description details with emojis for better visibility
    if (description.gender) resultText += `👤 Gender: ${description.gender}\n`;
    if (description.age_group) resultText += `👥 Age: ${description.age_group}\n`;
    if (description.clothing_top) resultText += `👕 Top: ${description.clothing_top}\n`;
    if (description.clothing_bottom) resultText += `👖 Bottom: ${description.clothing_bottom}\n`;
    if (description.accessories) resultText += `👜 Accessories: ${description.accessories}\n`;
    if (description.location_context) resultText += `🌍 Location Context: ${description.location_context}\n`;
    if (description.timestamp) resultText += `⏰ Last seen: ${new Date(description.timestamp).toLocaleString()}\n`;
    
    // Add a note about camera switching if applicable
    if (cameraId) {
      resultText += `\n✅ I've switched to Camera ${cameraId} to show you this person.`;
    }
    
    return resultText;
  }

  const handleSearchResults = async (results: any) => {
    if (!results || !results.matches || results.matches.length === 0) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I couldn\'t find any matches for your search. Please try describing the person differently.'
      }]);
      return;
    }

    // Get the first match's camera ID
    const match = results.matches[0];
    const cameraId = match.camera_id;

    if (!cameraId) {
      console.error('No camera ID found in search results');
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I found a match, but I couldn\'t determine which camera they were seen on. Please try searching again.'
      }]);
      return;
    }

    // Dispatch search results event
    const searchEvent = new CustomEvent('searchResults', {
      detail: { results }
    });
    window.dispatchEvent(searchEvent);

    // Find the camera in the list
    const camera = cameras.find(c => c.id === cameraId);
    if (!camera) {
      console.error(`Camera ${cameraId} not found in camera list`);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `I found a match on camera ${cameraId}, but I couldn't switch to that view. The person was last seen at ${match.location || 'an unknown location'}.`
      }]);
      return;
    }

    // Set the selected camera
    setSelectedCamera(camera);

    // Format and display the search results
    const formattedResults = formatSearchResults(results);
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: formattedResults
    }]);

    // Try to zoom to the camera location
    try {
      if (window.zoomToCamera && typeof window.zoomToCamera === 'function') {
        window.zoomToCamera(cameraId);
      } else {
        console.warn('zoomToCamera function not available');
      }
    } catch (error) {
      console.error('Error zooming to camera:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const newUserMessage: Message = { role: "user" as const, content: input };
    setMessages(prev => [...prev, newUserMessage]);
    setInput("");

    try {
      setIsLoading(true);

      // Check if it's a search query - expanded keywords for better detection
      const searchKeywords = [
        "find", "search", "look for", "show", "who", "wearing", "person", "people",
        "locate", "where is", "can you find", "help me find", "looking for",
        "describe", "identify", "spot", "see", "detect", "recognize"
      ];
      const isSearchQuery = searchKeywords.some(keyword => input.toLowerCase().includes(keyword));

      if (isSearchQuery) {
        console.log("Processing search query:", input);
        // Always use the /search endpoint for people searches
        const searchResults = await searchPeople(input);
        console.log("Search results:", searchResults);
        
        // Add a message indicating we're searching
        setMessages(prev => [...prev, {
          role: "assistant" as const,
          content: "🔍 Searching for people matching your description..."
        }]);
        
        // Process the search results
        await handleSearchResults(searchResults);
      } else {
        const aiResponse = await chatWithAI([...messages, newUserMessage]);
        setMessages(prev => [...prev, {
          role: "assistant",
          content: aiResponse.response
        }]);
      }
    } catch (error) {
      console.error("Error:", error);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "I encountered an error while processing your request. Please try again."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-lg font-semibold text-white">AI Assistant</h2>
        <p className="text-sm text-gray-400">Ask questions or search for people</p>
      </div>

      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-900"
      >
        <AnimatePresence>
          {messages.map((message, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} mb-4`}
            >
              <div className={`flex items-start space-x-2 max-w-[80%] ${message.role === "user" ? "flex-row-reverse space-x-reverse" : ""}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  message.role === "user" ? "bg-blue-600" : "bg-green-600"
                }`}>
                  {message.role === "user" ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-white" />}
                </div>
                <div className={`rounded-lg p-3 ${
                  message.role === "user" ? "bg-blue-600 text-white" : "bg-gray-800 text-white"
                }`}>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="p-3 max-w-[85%] mr-auto bg-gray-800 border-gray-700 text-gray-100">
              <div className="flex items-start gap-2">
                <div className="mt-1 p-1 rounded-full bg-gray-700">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                  <span className="text-sm text-gray-300">Thinking...</span>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-gray-800 bg-gray-950">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question or describe who you're looking for..."
            disabled={isLoading}
            className="flex-1 bg-gray-900 border-gray-800 text-white focus-visible:ring-blue-600"
          />
          <Button 
            type="submit" 
            disabled={isLoading || !input.trim()} 
            className="bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}

