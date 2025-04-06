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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userInput = input.trim();
    setInput("");
    setIsLoading(true);

    const newUserMessage: Message = {
      role: "user",
      content: userInput
    };
    setMessages(prev => [...prev, newUserMessage]);

    let response: Message;

    try {
      // Check if the server is healthy
      const isHealthy = await checkServerHealth();
      if (!isHealthy) {
        throw new Error("Server is not healthy. Please try again later.");
      }
      
      // Use the chat endpoint for all queries
      console.log("Sending chat request to AI:", [...messages, newUserMessage]);
      const aiResponse = await chatWithAI([...messages, newUserMessage]);
      console.log("AI response:", aiResponse);
      
      // Check if this is a search result response
      if (aiResponse.response.includes("I found") && 
          (aiResponse.response.includes("match") || aiResponse.response.includes("matches"))) {
        
        // Extract camera ID if present
        const cameraMatch = aiResponse.response.match(/camera ([A-Z0-9-]+)/i);
        if (cameraMatch && cameraMatch[1]) {
          const cameraId = cameraMatch[1];
          const camera = cameras.find((c: Camera) => c.id === cameraId);
          
          if (camera) {
            console.log("Setting selected camera:", camera);
            setSelectedCamera(camera);
          }
        }
        
        // Make a direct search request to get the full match data
        try {
          console.log("Making direct search request for detailed match data");
          const searchResponse = await fetch(`${API_BASE_URL}/search`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ description: userInput }),
          });
          
          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            console.log("Search data:", searchData);
            
            if (searchData.matches && searchData.matches.length > 0) {
              // Format the search results with detailed information
              let detailedResponse = aiResponse.response;
              
              // Add a section with detailed match information
              detailedResponse += "\n\n**Detailed Match Information:**\n";
              
              searchData.matches.forEach((match: any, index: number) => {
                detailedResponse += `\n**Match ${index + 1} (${match.similarity.toFixed(1)}% similar):**\n`;
                
                // Add description details
                if (match.description) {
                  detailedResponse += "```json\n";
                  detailedResponse += JSON.stringify(match.description, null, 2);
                  detailedResponse += "\n```\n";
                }
                
                // Add metadata
                if (match.metadata) {
                  detailedResponse += "**Metadata:**\n";
                  detailedResponse += "```json\n";
                  detailedResponse += JSON.stringify(match.metadata, null, 2);
                  detailedResponse += "\n```\n";
                }
              });
              
              response = {
                role: "assistant",
                content: detailedResponse
              };
            } else {
              response = {
                role: "assistant",
                content: aiResponse.response
              };
            }
          } else {
            response = {
              role: "assistant",
              content: aiResponse.response
            };
          }
        } catch (searchError) {
          console.error("Error fetching detailed search data:", searchError);
          response = {
            role: "assistant",
            content: aiResponse.response
          };
        }
      } else {
        response = {
          role: "assistant",
          content: aiResponse.response
        };
      }
    } catch (error) {
      console.error("Error in chat:", error);
      response = {
        role: "assistant",
        content: error instanceof Error ? error.message : "I'm sorry, I encountered an error. Please try again."
      };
    }

    setMessages(prev => [...prev, response]);
    setIsLoading(false);
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
                  message.role === "user" ? "bg-blue-600" : "bg-blue-600"
                }`}>
                  {message.role === "user" ? <User className="w-5 h-5 text-white" /> : <Bot className="w-15 h-15 text-white" />}
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

