"use client"

import { useState, useEffect, useRef } from "react"

interface LogoProps {
  size?: number
  className?: string
  maxMovement?: number // How far the eye can move from center
}

export default function Foresight({ size = 40, className = "", maxMovement = 5 }: LogoProps) {
  // State to track eye position
  const [eyePosition, setEyePosition] = useState({ x: 20, y: 20 })

  // Ref for the container element
  const containerRef = useRef<HTMLDivElement>(null)

  // Set up mouse tracking
  useEffect(() => {
    // Function to update eye position based on mouse coordinates
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return

      // Get viewport dimensions
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      // Calculate mouse position as percentage of viewport
      const mouseXPercent = e.clientX / viewportWidth
      const mouseYPercent = e.clientY / viewportHeight

      // Define the ellipse dimensions
      const eyeCenterX = 20
      const eyeCenterY = 20
      const ellipseRadiusX = 12 // Horizontal radius of the ellipse
      const ellipseRadiusY = 8 // Vertical radius of the ellipse (smaller to make it an oval)

      // Size of the circular iris
      const irisRadius = 4

      // Calculate the raw desired position
      const rawX = eyeCenterX + (mouseXPercent * 2 - 1) * maxMovement
      const rawY = eyeCenterY + (mouseYPercent * 2 - 1) * maxMovement

      // Constrain the pupil to stay within the elliptical bounds
      // We need to ensure the circular iris stays completely within the elliptical eye

      // Calculate the vector from center to desired position
      const vectorX = rawX - eyeCenterX
      const vectorY = rawY - eyeCenterY

      // Calculate the distance from the edge of the ellipse at this angle
      // Using parametric form of ellipse: x = a*cos(t), y = b*sin(t)
      // We need to find the angle t for our vector
      const angle = Math.atan2(vectorY, vectorX)

      // Distance to ellipse edge at this angle
      const distanceToEdge =
        (ellipseRadiusX * ellipseRadiusY) /
        Math.sqrt(Math.pow(ellipseRadiusY * Math.cos(angle), 2) + Math.pow(ellipseRadiusX * Math.sin(angle), 2))

      // Maximum allowed distance for the center of the iris
      // Subtract the iris radius to keep it fully inside
      const maxDistance = distanceToEdge - irisRadius

      // Current distance of the desired point
      const currentDistance = Math.sqrt(vectorX * vectorX + vectorY * vectorY)

      // Constrain if needed
      let constrainedX = rawX
      let constrainedY = rawY

      if (currentDistance > maxDistance && currentDistance > 0) {
        // Scale the vector to fit within the allowed distance
        const scale = maxDistance / currentDistance
        constrainedX = eyeCenterX + vectorX * scale
        constrainedY = eyeCenterY + vectorY * scale
      }

      // Update eye position
      setEyePosition({ x: constrainedX, y: constrainedY })
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

        {/* Elliptical eye with white border */}
        <ellipse cx="20" cy="20" rx="16" ry="12" stroke="white" strokeWidth="2" fill="none" />
        <ellipse cx="20" cy="20" rx="12" ry="8" fill="white" />

        {/* Iris (blue circle) - follows cursor */}
        <circle cx={eyePosition.x} cy={eyePosition.y} r="6" fill="#0073F5" />

        {/* Pupil (black circle) - follows cursor */}
        <circle cx={eyePosition.x} cy={eyePosition.y} r="3" fill="black" />
      </svg>
    </div>
  )
}

