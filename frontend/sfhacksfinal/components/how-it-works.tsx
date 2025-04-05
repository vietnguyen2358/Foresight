"use client"

import Image from "next/image"
import { motion, useScroll, useTransform } from "framer-motion"
import { useRef, useState } from "react"

export default function HowItWorks() {
  const steps = [
    {
      number: "01",
      title: "Video Ingestion",
      description: "CCTV footage is securely ingested into our system from authorized sources across the city.",
    },
    {
      number: "02",
      title: "AI Processing",
      description: "Our computer vision models detect people in each frame and extract visual features.",
    },
    {
      number: "03",
      title: "Natural Language Generation",
      description: "AI models convert visual data into searchable text descriptions of each detected individual.",
    },
    {
      number: "04",
      title: "Database Storage",
      description: "Descriptions, timestamps, and locations are indexed in our secure database for rapid searching.",
    },
    {
      number: "05",
      title: "Search & Retrieval",
      description: "First responders can query the database using natural language to find potential matches.",
    },
  ]

  // Refs for scroll animations
  const containerRef = useRef(null)

  // Track which step is hovered
  const [hoveredStep, setHoveredStep] = useState<number | null>(null)

  // Scroll progress for parallax effects
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  })

  // Transform values based on scroll
  const imageY = useTransform(scrollYProgress, [0, 1], [50, -50])

  // 3D perspective animation for steps
  const perspective = 1000
  const stepsContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.3,
      },
    },
  }

  const stepVariants = {
    hidden: {
      opacity: 0,
      rotateX: 45,
      z: -100,
      y: 50,
    },
    visible: {
      opacity: 1,
      rotateX: 0,
      z: 0,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 50,
        damping: 15,
      },
    },
  }

  return (
    <div className="py-24 bg-black overflow-hidden" ref={containerRef}>
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">How It Works</h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Our technology transforms raw video data into actionable intelligence for search and rescue operations.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div
            className="order-2 lg:order-1 perspective-[1000px]"
            variants={stepsContainerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            style={{ perspective }}
          >
            <div className="space-y-12 relative">
              {/* Timeline connector */}
              <motion.div
                className="absolute left-6 top-6 w-0.5 bg-gradient-to-b from-blue-600/0 via-blue-600 to-blue-600/0"
                style={{ height: "calc(100% - 48px)" }}
                initial={{ scaleY: 0, opacity: 0 }}
                whileInView={{ scaleY: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.5, delay: 0.5 }}
              />

              {steps.map((step, index) => (
                <motion.div
                  key={index}
                  className="flex relative z-10 transform-style-3d"
                  variants={stepVariants}
                  onHoverStart={() => setHoveredStep(index)}
                  onHoverEnd={() => setHoveredStep(null)}
                  whileHover={{
                    x: 10,
                    transition: { duration: 0.3 },
                  }}
                >
                  <div className="mr-6">
                    <motion.div
                      className="w-12 h-12 rounded-full bg-blue-900 flex items-center justify-center text-blue-300 font-bold relative"
                      whileHover={{ scale: 1.1 }}
                    >
                      {/* Improved ripple effect on hover with single animation */}
                      {hoveredStep === index && (
                        <motion.div
                          key={`ripple-${index}-${Date.now()}`} // Force new instance on each hover
                          className="absolute inset-0 rounded-full border-2 border-blue-500"
                          initial={{ scale: 1, opacity: 0.8 }}
                          animate={{
                            scale: [1, 1.5, 2],
                            opacity: [0.8, 0.4, 0],
                          }}
                          transition={{
                            duration: 1.5,
                            times: [0, 0.5, 1],
                            ease: "easeOut",
                            repeat: 0, // Play only once
                          }}
                        />
                      )}
                      {step.number}
                    </motion.div>
                  </div>
                  <div>
                    <motion.h3
                      className="text-xl font-semibold text-white mb-2"
                      animate={{
                        color: hoveredStep === index ? "#3b82f6" : "#ffffff",
                      }}
                      transition={{ duration: 0.3 }}
                    >
                      {step.title}
                    </motion.h3>
                    <p className="text-gray-400">{step.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div className="order-1 lg:order-2 relative" style={{ y: imageY }}>
            <div className="relative h-[500px] rounded-lg overflow-hidden border border-gray-800 shadow-xl">
              <Image
                src="/placeholder.svg?height=1000&width=800"
                alt="How Find & Seek works"
                fill
                className="object-cover"
              />
            </div>

            {/* Decorative elements */}
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-blue-500/10 rounded-full blur-xl"></div>
            <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-blue-500/10 rounded-full blur-xl"></div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

