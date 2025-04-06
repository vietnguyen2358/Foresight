"use client"
import { motion } from "framer-motion"
import { useState, useEffect } from "react"

// Animated counter component for statistics
const AnimatedCounter = ({
  value,
  suffix = "",
  duration = 2000,
}: { value: number; suffix?: string; duration?: number }) => {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let startTime: number
    let animationFrame: number

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)

      // Easing function for more dramatic effect at the end
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)
      setCount(Math.floor(value * easeOutQuart))

      if (progress < 1) {
        animationFrame = requestAnimationFrame(step)
      }
    }

    animationFrame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(animationFrame)
  }, [value, duration])

  return (
    <span>
      {count.toLocaleString()}
      {suffix}
    </span>
  )
}

export default function ProblemStats() {
  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 12,
      },
    },
  }

  const [dots, setDots] = useState<Array<{ size: number; x: string; y: string; duration: number; delay: number }>>([])

  // Generate dots only on client-side to avoid hydration mismatch
  useEffect(() => {
    const newDots = Array.from({ length: 24 }).map(() => ({
      size: Math.random() * 10 + 5,
      x: `${Math.random() * 100}%`,
      y: `${Math.random() * 100}%`,
      duration: Math.random() * 3 + 2,
      delay: Math.random() * 2,
    }))
    setDots(newDots)
  }, [])

  return (
    <div className="bg-gray-950 py-24 relative overflow-hidden">
      {/* Background elements */}
      <motion.div
        className="absolute top-0 left-0 w-full h-20 to-transparent"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5 }}
      />

      <div className="container mx-auto px-4 relative z-10">
        {/* Changed the order of elements for mobile - text first, then image */}
        <div className="flex flex-col lg:flex-row items-center gap-12">
          {/* Text section - now first in mobile view */}
          <motion.div
            className="w-full lg:w-1/2 order-1 lg:order-2"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <motion.h2 className="text-3xl md:text-4xl font-bold mb-6" variants={itemVariants}>
              <span className="text-white">Over </span>
              <span className="text-blue-500">800,000</span>
              <span className="text-white"> Children Go Missing</span>
              <span className="text-white"> Annually in the U.S</span>
            </motion.h2>

            <motion.p className="text-xl text-gray-300 mb-8" variants={itemVariants}>
              The first 24 hours are vital in locating a missing child, as the likelihood of a safe recovery drops
              sharply after this period. Our technology is built to enhance search efforts and response time when every
              second counts
            </motion.p>
          </motion.div>

          {/* Abstract visualization section - now second in mobile view */}
          <motion.div
            className="w-full lg:w-1/2 order-2 lg:order-1 mt-8 lg:mt-0"
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div className="relative h-[500px] rounded-lg overflow-hidden border border-gray-800 shadow-2xl bg-gradient-to-br from-gray-900 via-blue-900/30 to-black">
              {/* Abstract data visualization */}
              {/* Abstract data visualization */}
              {/* Abstract data visualization */}

              <div className="absolute inset-0">
                {/* Animated dots pattern - now using pre-generated values */}
                {dots.map((dot, i) => (
                  <motion.div
                    key={i}
                    className="absolute rounded-full bg-blue-500/20"
                    style={{
                      width: dot.size,
                      height: dot.size,
                      left: dot.x,
                      top: dot.y,
                    }}
                    animate={{
                      opacity: [0.1, 0.5, 0.1],
                      scale: [1, 1.5, 1],
                    }}
                    transition={{
                      duration: dot.duration,
                      repeat: Number.POSITIVE_INFINITY,
                      repeatType: "reverse",
                      delay: dot.delay,
                    }}
                  />
                ))}

                {/* Abstract lines */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {/* Horizontal lines */}
                  {Array.from({ length: 5 }).map((_, i) => (
                    <motion.line
                      key={`h-${i}`}
                      x1="0"
                      y1={20 + i * 15}
                      x2="100"
                      y2={20 + i * 15}
                      stroke="rgba(59, 130, 246, 0.2)"
                      strokeWidth="0.2"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 2, delay: i * 0.5 }}
                    />
                  ))}

                  {/* Vertical lines */}
                  {Array.from({ length: 5 }).map((_, i) => (
                    <motion.line
                      key={`v-${i}`}
                      x1={20 + i * 15}
                      y1="0"
                      x2={20 + i * 15}
                      y2="100"
                      stroke="rgba(59, 130, 246, 0.15)"
                      strokeWidth="0.2"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 2, delay: i * 0.5 }}
                    />
                  ))}

                  {/* Abstract data curve */}
                  <motion.path
                    d="M0,80 C20,90 40,70 60,75 S80,60 100,70"
                    fill="none"
                    stroke="rgba(59, 130, 246, 0.4)"
                    strokeWidth="0.5"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 3 }}
                  />
                </svg>

                {/* Symbolic silhouettes */}
                <div className="absolute left-1/4 top-1/3 transform -translate-x-1/2 -translate-y-1/2">
                  <motion.div
                    className="w-8 h-16 bg-blue-500/10 rounded-full"
                    animate={{ y: [0, -5, 0], opacity: [0.5, 0.8, 0.5] }}
                    transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY }}
                  />
                </div>
                <div className="absolute right-1/3 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <motion.div
                    className="w-6 h-12 bg-blue-500/10 rounded-full"
                    animate={{ y: [0, -3, 0], opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, delay: 1 }}
                  />
                </div>
              </div>

              {/* Overlay with statistics - keep this part */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-white">
                      <AnimatedCounter value={8000000} suffix="+" />
                    </div>
                    <div className="text-xs text-gray-300">Annual Missing Children Worldwide</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">
                      <AnimatedCounter value={20000} suffix="+" />
                    </div>
                    <div className="text-xs text-gray-300">Cases Remain Open</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">
                      <AnimatedCounter value={40} suffix="%" />
                    </div>
                    <div className="text-xs text-gray-300">Increase Since 1997</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

