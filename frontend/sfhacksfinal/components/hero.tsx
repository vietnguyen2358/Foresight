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

  const boundingBoxVariants = {
    hidden: { scale: 0.9, opacity: 0 },
    visible: {
      scale: 1,
      opacity: 0.7,
      transition: {
        duration: 0.5,
        ease: "easeOut",
        delay: 1.2,
      },
    },
  }

  const dataCardVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.5,
        ease: "easeOut",
        delay: 1.5,
      },
    },
  }

  return (
    <div className="relative bg-black overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-black z-0"></div>
      <div className="absolute inset-0 bg-[url('/placeholder.svg?height=100&width=100')] bg-repeat opacity-5 z-0"></div>

      <div className=" mx-auto px-20 py-40 relative z-10">
      
        <div className="flex flex-col lg:flex-row items-center">
          <motion.div
            className="lg:w-1/2 mb-12 lg:mb-0"
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
                Search & Rescue
              </motion.span>
              <motion.span
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.7 }}
              >
                {" "}
                for Urban Environments
              </motion.span>
            </motion.h1>

            <motion.p className="text-xl text-gray-300 mb-8 max-w-2xl" variants={itemVariants}>
              Leveraging computer vision and natural language understanding to help locate missing individuals in cities
              through intelligent video analysis.
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4"
              variants={itemVariants}
            >
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg">
                  <Link href="/search">Start Searching</Link>
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

          <motion.div className="lg:w-1/2 relative" initial="hidden" animate="visible" variants={imageVariants}>
            <div className="relative w-full h-[400px] rounded-lg overflow-hidden shadow-2xl border border-gray-800">
              <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent z-10"></div>
              <Image
                src="/placeholder.svg?height=800&width=1200"
                alt="REPLACE WITH ACTUAL EXAMPLE IMAGE"
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

