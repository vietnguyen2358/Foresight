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
    <div className="relative bg-black overflow-hidden w-full">
      {/* Background elements - ensure they span full width */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-black z-0 w-full"></div>
      <div className="absolute inset-0 bg-[url('/placeholder.svg?height=100&width=100')] bg-repeat opacity-5 z-0 w-full"></div>

      <div className="container mx-auto px-4 py-24 md:py-32 lg:py-40 relative z-10">
        {/* Adjust the layout to give more space to the image and push text to the side */}
        <div className="flex flex-col items-center lg:flex-row lg:items-start lg:justify-between">
          {/* Text section - reduce width on large screens to give more space to image */}
          <motion.div
            className="w-full lg:w-2/5 mb-16 lg:mb-0 lg:pr-8"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
          >
            {/* Text content remains the same */}
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
            </motion.div>
          </motion.div>

          {/* Image section - increase width on large screens */}
          <motion.div className="w-full lg:w-3/5 relative" initial="hidden" animate="visible" variants={imageVariants}>
            <div className="relative w-full h-[400px] md:h-[500px] rounded-lg overflow-hidden shadow-2xl ">
              <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent "></div>
              <Image
                src="/images/heroimg.png"
                alt="AI-powered child rescue technology visualization"
                fill
                className="object-cover"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

