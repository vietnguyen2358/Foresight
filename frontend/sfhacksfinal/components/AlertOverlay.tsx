"use client"

import { useState, useEffect } from "react"
import { AlertTriangle, X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface AlertOverlayProps {
  alert: {
    id: string
    timestamp: string
    location: string
    description: any
    alert_message: string
    score?: number
  }
  onClose: () => void
}

export default function AlertOverlay({ alert, onClose }: AlertOverlayProps) {
  const [isMinimized, setIsMinimized] = useState(false)
  
  // Auto-hide after 15 seconds, but keep minimized version
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMinimized(true)
    }, 15000)
    
    return () => clearTimeout(timer)
  }, [])
  
  // Format the match percentage
  const matchPercentage = alert.score 
    ? Math.round(alert.score * 100) 
    : 100

  return (
    <AnimatePresence>
      {!isMinimized ? (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-10 left-1/2 transform -translate-x-1/2 z-[1000] w-full max-w-2xl"
        >
          <div className="bg-red-900/90 border-2 border-red-500 rounded-lg p-4 text-white shadow-2xl">
            <div className="flex items-start justify-between">
              <div className="flex">
                <div className="mr-4">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ 
                      repeat: Infinity, 
                      duration: 1.5,
                      repeatType: "reverse" 
                    }}
                  >
                    <AlertTriangle className="h-10 w-10 text-red-300" />
                  </motion.div>
                </div>
                <div>
                  <h2 className="text-xl font-bold mb-2 flex items-center">
                    <span className="mr-2">AMBER ALERT</span>
                    <span className="text-sm bg-red-700 px-2 py-0.5 rounded-full">
                      {matchPercentage}% Match
                    </span>
                  </h2>
                  <p className="mb-3">{alert.alert_message}</p>
                  
                  <div className="mt-2 text-sm bg-red-950/80 p-3 rounded-md">
                    <h3 className="font-semibold mb-1 border-b border-red-700 pb-1">Description:</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {alert.description.gender && (
                        <div><span className="text-red-300">Gender:</span> {alert.description.gender}</div>
                      )}
                      {alert.description.age_group && (
                        <div><span className="text-red-300">Age:</span> {alert.description.age_group}</div>
                      )}
                      {alert.description.hair_style && (
                        <div><span className="text-red-300">Hair:</span> {alert.description.hair_style}</div>
                      )}
                      {alert.description.clothing_top && (
                        <div>
                          <span className="text-red-300">Top:</span> {alert.description.clothing_top_color} {alert.description.clothing_top}
                        </div>
                      )}
                      {alert.description.clothing_bottom && (
                        <div>
                          <span className="text-red-300">Bottom:</span> {alert.description.clothing_bottom_color} {alert.description.clothing_bottom}
                        </div>
                      )}
                      {alert.description.location_context && (
                        <div><span className="text-red-300">Location:</span> {alert.description.location_context}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <button 
                onClick={() => setIsMinimized(true)}
                className="text-white hover:text-red-200"
                aria-label="Minimize alert"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="flex justify-end mt-3">
              <button
                onClick={onClose}
                className="bg-red-700 hover:bg-red-600 px-4 py-1 rounded-md text-sm"
              >
                Dismiss
              </button>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 100, opacity: 0 }}
          className="fixed bottom-5 right-5 z-[1000]"
        >
          <button
            onClick={() => setIsMinimized(false)}
            className="flex items-center bg-red-800 hover:bg-red-700 text-white px-3 py-2 rounded-md shadow-lg"
          >
            <AlertTriangle className="h-5 w-5 mr-2" />
            <span>AMBER ALERT</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
} 