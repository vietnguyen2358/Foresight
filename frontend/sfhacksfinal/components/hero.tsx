"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"

export default function Hero() {
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
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.5, ease: "easeOut" },
    },
  }

  const imageVariants = {
    hidden: { scale: 1.05, opacity: 0 },
    visible: {
      scale: 1,
      opacity: 1,
      transition: { duration: 0.7, ease: "easeOut" },
    },
  }

  return (
    <div className="relative bg-black overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-black z-0"></div>
      <div className="absolute inset-0 bg-[url('/placeholder.svg?height=100&width=100')] bg-repeat opacity-5 z-0"></div>

      <div className="container mx-auto px-4 py-24 md:py-32 lg:py-40 relative z-10">
        {/* Main content container - always column on mobile, row only on large screens */}
        <div className="flex flex-col items-center lg:flex-row lg:items-start lg:justify-between">
          {/* Text section - full width on mobile, half width on large screens */}
          <motion.div
            className="w-full lg:w-1/2 mb-16 lg:mb-0 lg:pr-8"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
          >
            <motion.h1
              className="text-3xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6"
              variants={itemVariants}
            >
              <motion.span
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                AI-Powered{" "}
              </motion.span>
              <motion.span
                className="text-blue-500"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
              >
                Child Rescue
              </motion.span>
              <motion.span
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.7 }}
              >
                {" "}
                Technology
              </motion.span>
            </motion.h1>

            <motion.p className="text-xl text-gray-300 mb-8 max-w-2xl" variants={itemVariants}>
              Every minute counts. Our platform helps locate missing children within the critical first 24 hours using
              advanced AI video analysis and real-time alerts.
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4"
              variants={itemVariants}
            >
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg">
                  <Link href="/dashboard">Start Searching</Link>
                </Button>
              </motion.div>

              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-blue-600 text-blue-500 hover:bg-blue-900/20 text-lg"
                >
                  <Link href="/about">Learn More</Link>
                </Button>
              </motion.div>
            </motion.div>
          </motion.div>

          {/* Image section - full width on mobile, half width on large screens */}
          <motion.div className="w-full lg:w-1/2 relative" initial="hidden" animate="visible" variants={imageVariants}>
            <div className="relative w-full h-[400px] rounded-lg overflow-hidden shadow-2xl border border-gray-800">
              <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent z-10"></div>
              <Image
                src="/placeholder.svg?height=800&width=1200"
                alt="AI-powered child rescue technology visualization"
                fill
                className="object-cover"
              />

              {/* AI interface overlay elements */}
              <div className="absolute inset-0 z-20">
                {/* Bounding box 1 */}
                <motion.div
                  className="absolute top-[30%] left-[20%] w-[100px] h-[200px] border-2 border-blue-500 rounded-md opacity-70"
                  animate={{
                    opacity: [0.4, 0.7, 0.4],
                    scale: [1, 1.02, 1],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Number.POSITIVE_INFINITY,
                    repeatType: "reverse",
                  }}
                ></motion.div>

                {/* Bounding box 2 */}
                <motion.div
                  className="absolute top-[40%] right-[30%] w-[80px] h-[180px] border-2 border-blue-500 rounded-md opacity-70"
                  animate={{
                    opacity: [0.4, 0.7, 0.4],
                    scale: [1, 1.02, 1],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Number.POSITIVE_INFINITY,
                    repeatType: "reverse",
                    delay: 0.5,
                  }}
                ></motion.div>

                {/* Label 1 */}
                <div className="absolute top-[25%] left-[20%] bg-blue-900/80 text-white text-xs px-2 py-1 rounded">
                  Person: 98%
                </div>

                {/* Label 2 */}
                <div className="absolute top-[35%] right-[30%] bg-blue-900/80 text-white text-xs px-2 py-1 rounded">
                  Person: 95%
                </div>

                {/* Data card */}
                <div className="absolute bottom-4 left-4 right-4 bg-black/70 p-3 rounded-md border border-gray-700">
                  <div className="text-xs text-gray-300 mb-1">AI Analysis</div>
                  <div className="text-sm text-white">
                    Child with red backpack identified near Central Park, timestamp: 14:32:05
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

