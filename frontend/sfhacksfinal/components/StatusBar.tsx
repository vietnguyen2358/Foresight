"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Cloud, Sun, Server, Clock, Thermometer, Wifi, WifiOff } from "lucide-react"

export default function StatusBar() {
  const [time, setTime] = useState(new Date())
  const [serverStatus, setServerStatus] = useState(true) // Assume server is online by default
  const [weather, setWeather] = useState({
    condition: "sunny", // sunny, cloudy, rainy
    temperature: 72, // in Fahrenheit
  })

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Check server status periodically
  useEffect(() => {
    const checkServerStatus = async () => {
      try {
        const response = await fetch(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000')
        setServerStatus(response.ok)
      } catch (error) {
        setServerStatus(false)
      }
    }

    checkServerStatus()
    const interval = setInterval(checkServerStatus, 30000) // Check every 30 seconds

    return () => clearInterval(interval)
  }, [])

  // Format time as HH:MM:SS
  const formattedTime = time.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })

  // Format date as MM/DD/YYYY
  const formattedDate = time.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric'
  })

  // Weather icon based on condition
  const WeatherIcon = () => {
    switch (weather.condition) {
      case "sunny":
        return <Sun className="h-5 w-5 text-yellow-400" />
      case "cloudy":
        return <Cloud className="h-5 w-5 text-gray-400" />
      default:
        return <Cloud className="h-5 w-5 text-blue-400" />
    }
  }

  return (
    <div className="bg-gray-900 border-b border-gray-800 text-white py-1 px-4">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-6">
          {/* Date and Time */}
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-blue-400" />
            <motion.span
              key={formattedTime}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="font-mono text-sm"
            >
              {formattedDate} {formattedTime}
            </motion.span>
          </div>

          {/* Weather and Temperature */}
          <div className="flex items-center space-x-2">
            <WeatherIcon />
            <motion.span
              key={weather.temperature}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="font-mono text-sm"
            >
              {weather.temperature}°F
            </motion.span>
          </div>
        </div>

        <div className="flex items-center space-x-6">
          {/* Server Status */}
          <div className="flex items-center space-x-2">
            <Server className="h-4 w-4 text-blue-400" />
            <div className="flex items-center">
              <motion.div
                animate={{
                  scale: serverStatus ? [1, 1.2, 1] : 1,
                  opacity: serverStatus ? 1 : 0.5
                }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="flex items-center"
              >
                <span className={`h-2 w-2 rounded-full mr-2 ${serverStatus ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <span className="font-mono text-sm">{serverStatus ? 'SERVER ONLINE' : 'SERVER OFFLINE'}</span>
              </motion.div>
            </div>
          </div>

          {/* Network Status */}
          <div className="flex items-center space-x-2">
            {serverStatus ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500" />
            )}
            <span className="font-mono text-sm">{serverStatus ? 'NETWORK CONNECTED' : 'NETWORK DISCONNECTED'}</span>
          </div>
        </div>
      </div>
    </div>
  )
} 