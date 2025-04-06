"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, User, Bot, Loader2, Info, Camera as CameraIcon, MapPin } from "lucide-react"
import { Card } from "@/components/ui/card"
import { API_BASE_URL, checkServerHealth } from "@/lib/api"
import { motion, AnimatePresence } from "framer-motion"
import { useCamera, type Camera } from "@/lib/CameraContext"
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"

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
    if (!input.trim() || isLoading) return;

    const userInput = input.trim();
    setInput("");
    setIsLoading(true);

    const newUserMessage: Message = {
      role: "user",
      content: userInput
    };
    setMessages(prev => [...prev, newUserMessage]);

    try {
      const isHealthy = await checkServerHealth();
      if (!isHealthy) {
        throw new Error("Server is not healthy. Please try again later.");
      }
      
      console.log("Making search request for:", userInput);
      const searchResponse = await fetch(`${API_BASE_URL}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description: userInput }),
      });
      
      if (!searchResponse.ok) {
        throw new Error(`Search failed: ${searchResponse.statusText}`);
      }

      const searchData = await searchResponse.json();
      console.log("Search results:", searchData);
      
      let responseContent = "";
      
      if (searchData.matches && searchData.matches.length > 0) {
        const bestMatch = searchData.matches[0];
        
        if (bestMatch.metadata?.camera_id) {
          const matchCamera = cameras.find((c) => c.id === bestMatch.metadata.camera_id);
          if (matchCamera) {
            setSelectedCamera(matchCamera);
            responseContent = `Found a match!\n\nPerson Details:\n${JSON.stringify(bestMatch.description, null, 2)}\n\nLocation: Camera ${matchCamera.name} (${matchCamera.id})`;
          }
        } else {
          responseContent = `Found a match!\n\nPerson Details:\n${JSON.stringify(bestMatch.description, null, 2)}`;
        }
      } else {
        responseContent = "No matches found for your search. Try describing the person differently.";
      }

      setMessages(prev => [...prev, {
        role: "assistant",
        content: responseContent,
        matches: searchData.matches || []
      }]);

    } catch (error) {
      console.error("Search error:", error);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : 'Something went wrong'}`
      }]);
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
      .map(([key, value]) => ({ key, value }));
    
    // Get image path if available
    const imagePath = metadata.image_path ? `${API_BASE_URL}/${metadata.image_path}` : null;
    
    return (
      <Card key={index} className="p-4 mb-4 border border-primary/20">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-semibold">Match #{index + 1}</h3>
          <Badge variant={similarity > 80 ? "default" : similarity > 60 ? "secondary" : "outline"}>
            {similarity.toFixed(1)}% match
          </Badge>
        </div>
        
        {imagePath && (
          <div className="mb-3 flex justify-center">
            <div className="relative w-48 h-48 overflow-hidden rounded-md border border-border">
              <img 
                src={imagePath} 
                alt={`Person match #${index + 1}`} 
                className="object-cover w-full h-full"
                onError={(e) => {
                  // Hide the image if it fails to load
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          </div>
        )}
        
        {uniqueAttributes.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {uniqueAttributes.map((attr, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {attr.key.replace(/_/g, ' ')}: {attr.value}
              </Badge>
            ))}
          </div>
        )}
        
        {matchCamera && (
          <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
            <CameraIcon className="h-4 w-4" />
            <span>Camera: {matchCamera.name}</span>
            <MapPin className="h-4 w-4 ml-2" />
            <span>{matchCamera.id}</span>
          </div>
        )}
        
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
    <div className="flex flex-col h-full">
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
      
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
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
                message.role === "user" ? "bg-primary/10" : "bg-secondary/10"
              }`}>
                <div className="flex items-start gap-2">
                  {message.role === "user" ? (
                    <User className="h-5 w-5 mt-1" />
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

