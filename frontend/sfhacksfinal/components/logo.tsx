"use client"

import { useState, useEffect, useRef } from "react"

interface LogoProps {
  size?: number
  className?: string
  maxMovement?: number // How far the eye can move from center
}

export default function WatchdogLogo({ size = 40, className = "", maxMovement = 5 }: LogoProps) {
  // State to track eye position
  const [eyePosition, setEyePosition] = useState({ x: 20, y: 20 })

  // Ref for the container element
  const containerRef = useRef<HTMLDivElement>(null)

  // Set up mouse tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return

      // Get viewport dimensions
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      // Calculate mouse position as percentage of viewport
      // This makes movement more dramatic across the entire screen
      const mouseXPercent = e.clientX / viewportWidth
      const mouseYPercent = e.clientY / viewportHeight

      // Convert to coordinates within the eye's range of motion
      // Map from [0,1] to [20-maxMovement, 20+maxMovement]
      const eyeX = 20 + (mouseXPercent * 2 - 1) * maxMovement
      const eyeY = 20 + (mouseYPercent * 2 - 1) * maxMovement

      // Update eye position
      setEyePosition({ x: eyeX, y: eyeY })
    }

    // Add event listener
    window.addEventListener("mousemove", handleMouseMove)

    // Clean up
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
    }
  }, [maxMovement])

  return (
    <div ref={containerRef} className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Background */}
        <rect width="40" height="40" rx="8" fill="#0073F5" />

        {/* Watchdog Eye with white border */}
        <circle cx="20" cy="20" r="12" stroke="white" strokeWidth="2" fill="none" />
        <circle cx="20" cy="20" r="8" fill="white" />

        {/* Iris (blue circle) - follows cursor */}
        <circle cx={eyePosition.x} cy={eyePosition.y} r="4" fill="#0073F5" />

        {/* Pupil - follows cursor */}
        <circle cx={eyePosition.x} cy={eyePosition.y} r="2" fill="black" />
      </svg>
    </div>
  )
}

