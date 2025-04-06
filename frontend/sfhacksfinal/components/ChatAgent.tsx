"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, User, Bot, Loader2, Info, Camera as CameraIcon, MapPin } from "lucide-react"
import { Card } from "@/components/ui/card"
import { API_BASE_URL, checkServerHealth, searchPeople } from "@/lib/api"
import { motion, AnimatePresence } from "framer-motion"
import { useCamera, type Camera } from "@/lib/CameraContext"
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type MatchDescription = {
  id?: string;
  timestamp?: string;
  [key: string]: any;
};

type MatchMetadata = {
  camera_id?: string;
  image_path?: string;
  [key: string]: any;
};

type Match = {
  description: MatchDescription;
  metadata: MatchMetadata;
  similarity: number;
};

type Message = {
  role: "user" | "assistant"
  content: string
  matches?: Match[]
}

export default function ChatAgent() {
  const { selectedCamera, setSelectedCamera, cameras } = useCamera()
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I can help you search for people. Describe what you're looking for in detail.",
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [searchGuidelines, setSearchGuidelines] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  // Fetch search guidelines on component mount
  useEffect(() => {
    const fetchGuidelines = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/search_guidelines`);
        if (response.ok) {
          const data = await response.json();
          setSearchGuidelines(data.guidelines || []);
        }
      } catch (error) {
        console.error("Failed to fetch search guidelines:", error);
      }
    };
    
    fetchGuidelines();
  }, []);

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

  useEffect(() => {
    if (selectedCamera) {
      console.log("Selected camera changed in ChatAgent:", selectedCamera);
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
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    try {
      setIsLoading(true);
      
      // Search for people
      const searchResults = await searchPeople(userMessage);
      
      // Add assistant message with search results
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: searchResults.rag_response || "I found some matches for your search.",
          matches: searchResults.matches,
        },
      ]);
    } catch (error) {
      console.error("Error searching for people:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error while searching. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to render a match card with detailed information
  const renderMatchCard = (match: Match, index: number) => {
    const description = match.description || {};
    const metadata = match.metadata || {};
    const similarity = match.similarity || 0;
    
    // Find camera if available
    const matchCamera = metadata.camera_id 
      ? cameras.find((c) => c.id === metadata.camera_id)
      : null;
    
    // Extract unique attributes for badges
    const uniqueAttributes = Object.entries(description)
      .filter(([key, value]) => 
        value && 
        typeof value === 'string' && 
        value.trim() !== '' && 
        !['id', 'timestamp'].includes(key)
      )
      .map(([key, value]) => `${key}:${value}`);
    
    return (
      <Card key={index} className="p-4 bg-gray-800/50">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center">
            <User className="h-4 w-4 text-blue-400 mr-2" />
            <span className="text-sm font-medium text-white">
              Match {index + 1} ({similarity.toFixed(1)}% match)
            </span>
          </div>
          {matchCamera && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-blue-400 hover:text-blue-300"
              onClick={() => setSelectedCamera(matchCamera)}
            >
              <CameraIcon className="h-3 w-3 mr-1" />
              View Camera
            </Button>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-300 mb-3">
          {metadata.camera_id && (
            <div className="flex items-center">
              <CameraIcon className="h-3 w-3 mr-1 text-gray-400" />
              <span>{metadata.camera_id}</span>
            </div>
          )}
          {metadata.timestamp && (
            <div className="flex items-center">
              <MapPin className="h-3 w-3 mr-1 text-gray-400" />
              <span>{new Date(metadata.timestamp).toLocaleString()}</span>
            </div>
          )}
        </div>
        
        <div className="flex flex-wrap gap-1 mb-3">
          {uniqueAttributes.map((attr, i) => (
            <Badge key={i} variant="outline" className="text-xs">
              {attr}
            </Badge>
          ))}
        </div>
        
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="description">
            <AccordionTrigger>Detailed Description</AccordionTrigger>
            <AccordionContent>
              <pre className="text-xs overflow-auto p-2 bg-muted rounded-md">
                {JSON.stringify(description, null, 2)}
              </pre>
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="metadata">
            <AccordionTrigger>Metadata</AccordionTrigger>
            <AccordionContent>
              <pre className="text-xs overflow-auto p-2 bg-muted rounded-md">
                {JSON.stringify(metadata, null, 2)}
              </pre>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>
    );
  };

  return (
    <div className="flex flex-col h-full left-sidebar-content">
      <div className="p-2 border-b flex items-center justify-between">
        <h2 className="text-lg font-semibold">Person Search</h2>
        <div className="relative group">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Info className="h-4 w-4" />
          </Button>
          <div className="absolute right-0 top-10 w-80 p-2 bg-popover text-popover-foreground rounded-md shadow-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
            <div className="text-xs">
              <p className="font-semibold mb-1">Search Tips:</p>
              <ul className="list-disc pl-2 space-y-1">
                {searchGuidelines.map((guideline, i) => (
                  <li key={i}>{guideline}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
      
      <div 
        ref={chatContainerRef} 
        className="flex-1 overflow-y-auto p-4 space-y-4"
        style={{ 
          scrollbarWidth: 'thin',
          scrollbarColor: '#4B5563 #1F2937',
          msOverflowStyle: 'none'
        }}
      >
        <style jsx>{`
          div::-webkit-scrollbar {
            width: 6px;
          }
          div::-webkit-scrollbar-track {
            background: #1F2937;
          }
          div::-webkit-scrollbar-thumb {
            background-color: #4B5563;
            border-radius: 3px;
          }
          div::-webkit-scrollbar-thumb:hover {
            background-color: #6B7280;
          }
        `}</style>
        
        <AnimatePresence>
          {messages.map((message, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Card className={`p-4 ${
                message.role === "user" ? "bg-blue-600/60" : "bg-secondary/10"
              }`}>
                <div className="flex items-start gap-2">
                  {message.role === "user" ? (
                    <User className="h-5 w-5 mt-1 text-white-500" />
                  ) : (
                    <Bot className="h-5 w-5 mt-1" />
                  )}
                  <div className="flex-1">
                    <div className="whitespace-pre-wrap">{message.content}</div>
                    
                    {message.role === "assistant" && message.matches && message.matches.length > 0 && (
                      <div className="mt-4">
                        {message.matches.map((match, i) => renderMatchCard(match, i))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe the person you're looking for in detail..."
            disabled={isLoading}
            className="border-blue-500 focus:border-blue-600 focus:ring-blue-500"
          />
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

