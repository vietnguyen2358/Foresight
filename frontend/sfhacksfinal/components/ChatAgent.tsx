"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, User, Bot, Loader2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { searchPerson, chat, type SearchResult, type ChatMessage } from "@/lib/api"
import { motion, AnimatePresence } from "framer-motion"
import MatchSidebar from "./MatchSidebar"

type Message = {
  role: "user" | "assistant"
  content: string
  searchResults?: SearchResult
}

export default function ChatAgent() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm your AI assistant. I can help you search for people and chat with you. What would you like to know?",
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [currentSearchResults, setCurrentSearchResults] = useState<SearchResult | null>(null)
  const [showSidebar, setShowSidebar] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      const chatContainer = chatContainerRef.current
      if (chatContainer) {
        // Use requestAnimationFrame to ensure the DOM has updated
        requestAnimationFrame(() => {
          chatContainer.scrollTo({
            top: chatContainer.scrollHeight,
            behavior: "smooth"
          })
        })
      }
    }
  }

  // Scroll to bottom when messages change or typing indicator appears
  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading, isTyping])

  // Also scroll when the component mounts
  useEffect(() => {
    scrollToBottom()
  }, [])

  // Handle image loading to ensure scrolling works with images
  const handleImageLoad = () => {
    scrollToBottom()
  }

  const formatSearchResults = (results: SearchResult): string => {
    if (!results.matches || results.matches.length === 0) {
      return "I couldn't find any matches for your search. " + (results.suggestions?.join(" ") || "");
    }

    const matchCount = results.matches.length;
    let response = `I found ${matchCount} potential match${matchCount > 1 ? 'es' : ''}:\n\n`;

    results.matches.forEach((match, index) => {
      const similarity = match.similarity.toFixed(1);
      const description = match.description;
      
      response += `${index + 1}. Match (${similarity}% similarity):\n`;
      response += `   - Gender: ${description.gender || 'N/A'}\n`;
      response += `   - Age: ${description.age_group || 'N/A'}\n`;
      response += `   - Clothing: ${description.clothing_top || 'N/A'} (${description.clothing_top_color || 'N/A'})\n`;
      if (description.clothing_bottom) {
        response += `   - Bottom: ${description.clothing_bottom} (${description.clothing_bottom_color || 'N/A'})\n`;
      }
      response += '\n';
    });

    return response;
  };

  const isExplicitSearchQuery = (text: string): boolean => {
    const searchTriggers = [
      'find', 'look for', 'search for', 'can you find', 'can you look for',
      'can you search for', 'help me find', 'help me look for', 'help me search for',
      'looking for', 'searching for', 'trying to find'
    ];
    
    const lowerText = text.toLowerCase();
    return searchTriggers.some(trigger => lowerText.includes(trigger));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const userMessage: Message = {
      role: "user",
      content: input,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)
    setIsTyping(true)

    try {
      let response: Message;
      
      if (isExplicitSearchQuery(input)) {
        // Handle search query
        const searchResults = await searchPerson(input);
        setCurrentSearchResults(searchResults);
        
        // Check if we have high similarity matches to show the sidebar
        const hasHighSimilarityMatches = searchResults.matches?.some(match => match.similarity > 70);
        setShowSidebar(hasHighSimilarityMatches);
        
        response = {
          role: "assistant",
          content: formatSearchResults(searchResults),
          searchResults: searchResults
        };
      } else {
        // Handle general conversation using Gemini AI
        try {
          // Convert messages to the format expected by the chat API
          const chatMessages: ChatMessage[] = messages.map(msg => ({
            role: msg.role,
            content: msg.content
          }));
          
          // Add the current user message
          chatMessages.push({ role: 'user', content: input });
          
          // Get response from Gemini AI
          const aiResponse = await chat(chatMessages);
          
          response = {
            role: "assistant",
            content: aiResponse
          };
        } catch (chatError) {
          console.error("Chat error:", chatError);
          response = {
            role: "assistant",
            content: "I'm having trouble with the chat right now. You can still search for people by using phrases like 'find someone' or 'look for a person'."
          };
        }
      }

      // Simulate typing delay for more natural feel
      setTimeout(() => {
        setMessages((prev) => [...prev, response])
        setIsLoading(false)
        setIsTyping(false)
      }, 500)
    } catch (error) {
      console.error("Error processing request:", error)
      const errorMessage: Message = {
        role: "assistant",
        content: "I'm sorry, I encountered an error while processing your request. Please try again.",
      }
      setMessages((prev) => [...prev, errorMessage])
      setIsLoading(false)
      setIsTyping(false)
    }
  }

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
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Card
                className={`p-3 max-w-[85%] ${
                  message.role === "user"
                    ? "ml-auto bg-blue-900/30 border-blue-800 text-white"
                    : "mr-auto bg-gray-800 border-gray-700 text-gray-100"
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className={`mt-1 p-1 rounded-full ${message.role === "user" ? "bg-blue-700" : "bg-gray-700"}`}>
                    {message.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>
                  <div className="whitespace-pre-wrap">
                    <p className="text-sm">{message.content}</p>
                    {message.searchResults?.matches && message.searchResults.matches.length > 0 && (
                      <motion.div 
                        className="mt-2 grid grid-cols-1 gap-2"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2, duration: 0.3 }}
                      >
                        {message.searchResults.matches.map((match, idx) => (
                          match.image_data && (
                            <motion.img
                              key={idx}
                              src={`data:image/jpeg;base64,${match.image_data}`}
                              alt={`Match ${idx + 1}`}
                              className="rounded-lg max-w-full h-auto"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.1 * idx, duration: 0.3 }}
                              onLoad={handleImageLoad}
                            />
                          )
                        ))}
                      </motion.div>
                    )}
                  </div>
                </div>
              </Card>
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
        
        {isTyping && !isLoading && (
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
                <div className="flex items-center gap-1">
                  <motion.span 
                    className="text-sm text-gray-300"
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    Typing
                  </motion.span>
                  <motion.div 
                    className="flex gap-1"
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <span className="text-sm text-gray-300">.</span>
                    <span className="text-sm text-gray-300">.</span>
                    <span className="text-sm text-gray-300">.</span>
                  </motion.div>
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

      {/* Match Sidebar */}
      <MatchSidebar 
        searchResults={currentSearchResults}
        isVisible={showSidebar}
        onClose={() => setShowSidebar(false)}
      />
    </div>
  )
}

