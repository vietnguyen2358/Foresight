"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, User, Bot } from "lucide-react"
import { Card } from "@/components/ui/card"
import { generateText } from "ai"
import { google } from "@ai-sdk/google"

type Message = {
  role: "user" | "assistant"
  content: string
}

export default function ChatAgent() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello! I can help you search for people based on their characteristics. For example, you can ask me to find 'a person wearing a red jacket near Market Street' or 'someone with a blue backpack at Civic Center'.",
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      const chatContainer = messagesEndRef.current.parentElement
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight
      }
    }
  }

  useEffect(() => {
    // Only scroll if the last message is from the assistant or if we're adding the first message
    if (messages.length > 0 && (messages[messages.length - 1].role === "assistant" || messages.length === 1)) {
      scrollToBottom()
    }
  }, [messages])

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

    try {
      // Create a context with previous messages
      const context = messages.map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`).join("\n")

      const systemPrompt = `You are a helpful assistant for the Find & Seek application, which helps locate missing people in San Francisco.
      Your job is to help users search the database by understanding their queries about people's characteristics.
      When users describe someone, respond as if you're searching the database and provide potential matches.
      For example, if they ask about "a person in a red jacket near Market Street", respond with potential matches like
      "I found 3 people matching that description at Market Street between 2-3pm today."
      Keep responses concise and focused on helping find people based on descriptions.`

      const { text } = await generateText({
        model: google("gemini-1.5-pro"),
        system: systemPrompt,
        prompt: `${context}\nUser: ${input}\nAssistant:`,
      })

      const assistantMessage: Message = {
        role: "assistant",
        content: text,
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error("Error generating response:", error)
      const errorMessage: Message = {
        role: "assistant",
        content: "I'm sorry, I encountered an error while processing your request. Please try again.",
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-lg font-semibold text-white">Find & Seek AI Assistant</h2>
        <p className="text-sm text-gray-400">Describe who you're looking for</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-900">
        {messages.map((message, index) => (
          <Card
            key={index}
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
              <div>
                <p className="text-sm">{message.content}</p>
              </div>
            </div>
          </Card>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-gray-800 bg-gray-950">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe who you're looking for..."
            disabled={isLoading}
            className="flex-1 bg-gray-900 border-gray-800 text-white focus-visible:ring-blue-600"
          />
          <Button type="submit" disabled={isLoading || !input.trim()} className="bg-blue-600 hover:bg-blue-700">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}

