"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { motion } from "framer-motion"
import { useState, useEffect } from "react"

export default function CTA() {
  // Track hydration status
  const [isHydrated, setIsHydrated] = useState(false)

  // Generate particles only after hydration
  const [particles, setParticles] = useState<
    Array<{
      width: number
      height: number
      left: string
      top: string
      yMove: number[]
      xMove: number[]
      duration: number
    }>
  >([])

  // Set hydration state after component mounts
  useEffect(() => {
    setIsHydrated(true)

    // Generate particle data after hydration
    const newParticles = Array.from({ length: 15 }, () => ({
      width: Math.random() * 6 + 2,
      height: Math.random() * 6 + 2,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      yMove: [Math.random() * -20, Math.random() * 20],
      xMove: [Math.random() * -20, Math.random() * 20],
      duration: Math.random() * 5 + 5,
    }))

    setParticles(newParticles)
  }, [])

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.1,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 10,
      },
    },
  }

  const buttonVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 200,
        damping: 15,
        delay: 0.6,
      },
    },
    hover: {
      scale: 1.05,
      boxShadow: "0 0 15px rgba(59, 130, 246, 0.5)",
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 10,
      },
    },
    tap: {
      scale: 0.95,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 10,
      },
    },
  }

  // Gradient animation for background
  const gradientVariants = {
    initial: {
      background: "radial-gradient(circle at 50% 50%, rgba(37, 99, 235, 0.1) 0%, rgba(0, 0, 0, 0) 70%)",
    },
    animate: {
      background: [
        "radial-gradient(circle at 50% 50%, rgba(37, 99, 235, 0.1) 0%, rgba(0, 0, 0, 0) 70%)",
        "radial-gradient(circle at 60% 40%, rgba(37, 99, 235, 0.15) 0%, rgba(0, 0, 0, 0) 70%)",
        "radial-gradient(circle at 40% 60%, rgba(37, 99, 235, 0.1) 0%, rgba(0, 0, 0, 0) 70%)",
        "radial-gradient(circle at 50% 50%, rgba(37, 99, 235, 0.1) 0%, rgba(0, 0, 0, 0) 70%)",
      ],
      transition: {
        duration: 8,
        repeat: Number.POSITIVE_INFINITY,
        repeatType: "reverse" as const,
      },
    },
  }

  return (
    <motion.div
      className="py-24 bg-black relative overflow-hidden"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      variants={containerVariants}
    >
      {/* Animated background gradient */}
      <motion.div className="absolute inset-0 z-0" variants={gradientVariants} initial="initial" animate="animate" />

      {/* Floating particles - only rendered after hydration */}
      <div className="absolute inset-0 z-0">
        {isHydrated &&
          particles.map((particle, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full bg-blue-500/20"
              style={{
                width: particle.width,
                height: particle.height,
                left: particle.left,
                top: particle.top,
              }}
              animate={{
                y: particle.yMove,
                x: particle.xMove,
                opacity: [0.2, 0.5, 0.2],
              }}
              transition={{
                duration: particle.duration,
                repeat: Number.POSITIVE_INFINITY,
                repeatType: "reverse" as const,
                ease: "easeInOut",
              }}
            />
          ))}
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h2 className="text-3xl md:text-4xl font-bold text-white mb-6" variants={itemVariants}>
          Every minute counts in finding a missing child
          </motion.h2>

          <motion.p className="text-xl text-gray-300 mb-8" variants={itemVariants}>
          Join our mission to revolutionize how we locate missing children during the critical first 24 hours. Together, we can bring more children home safely.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4"
            variants={itemVariants}
          >
            <motion.div variants={buttonVariants} whileHover="hover" whileTap="tap">
              <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg relative group">
                <Link href="/dashboard">
                  Start Using Foresight
                  {/* Arrow animation */}
                  <motion.span
                    className="inline-block ml-2"
                    animate={{ x: [0, 4, 0] }}
                    transition={{
                      duration: 1.5,
                      repeat: Number.POSITIVE_INFINITY,
                      repeatType: "loop" as const,
                      ease: "easeInOut",
                    }}
                  >
                    →
                  </motion.span>
                  {/* Button glow effect */}
                  <motion.span
                    className="absolute inset-0 rounded-md bg-blue-500/50 -z-10"
                    initial={{ opacity: 0 }}
                    whileHover={{
                      opacity: 0.5,
                      scale: 1.05,
                    }}
                    transition={{
                      duration: 0.3,
                    }}
                  />
                </Link>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Bottom wave decoration */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-8 bg-blue-900/10"
        initial={{ scaleX: 0, originX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.5, delay: 0.8 }}
      >
        <svg
          className="absolute top-0 w-full h-full text-blue-900/10"
          preserveAspectRatio="none"
          viewBox="0 0 1200 120"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z"
            fill="currentColor"
          />
        </svg>
      </motion.div>
    </motion.div>
  )
}

