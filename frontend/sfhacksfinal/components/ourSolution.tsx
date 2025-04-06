"use client"

import Image from "next/image"
import { motion, useScroll, useTransform } from "framer-motion"
import { useRef, useState } from "react"

export default function HowItWorks() {
  const steps = [
    {
      number: "01",
      title: "Alert Activation",
      description:
        "When a child is reported missing, our system immediately begins processing data from authorized sources.",
    },
    {
      number: "02",
      title: "AI Visual Analysis",
      description: "Our specialized algorithms scan video feeds to identify children matching the description.",
    },
    {
      number: "03",
      title: "Pattern Recognition",
      description: "The system analyzes movement patterns and predicts possible locations based on behavioral models.",
    },
    {
      number: "04",
      title: "Real-Time Alerts",
      description: "When potential matches are found, authorities receive immediate notifications with location data.",
    },
    {
      number: "05",
      title: "Coordinated Response",
      description: "Search teams can access our platform to coordinate efforts and respond to sightings efficiently.",
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
    <div className="py-24 bg-black overflow-hidden" ref={containerRef} id="howitworks">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Our Child Rescue Solution</h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Our technology transforms raw video data into <span className="text-blue-500">actionable intelligence</span>{" "}
            to help locate missing children within the critical 24-hour window.
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

