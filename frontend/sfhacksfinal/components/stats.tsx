"use client"

import { useRef, useEffect, useState } from "react"
import { motion, useInView, useAnimation } from "framer-motion"

export default function Stats() {
  const stats = [
    { value: "95%", label: "Accuracy in child detection" },
    { value: "3-5x", label: "Faster than manual search methods" },
    { value: "24/7", label: "Real-time monitoring capabilities" },
  ]

  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, amount: 0.3 })
  const controls = useAnimation()

  useEffect(() => {
    if (isInView) {
      controls.start("visible")
    }
  }, [isInView, controls])

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: "easeOut",
      },
    },
  }

  return (
    <div className="bg-blue-900 py-16" ref={ref}>
      <div className="container mx-auto px-4">
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3  gap-8"
          variants={containerVariants}
          initial="hidden"
          animate={controls}
        >
          {stats.map((stat, index) => (
            <motion.div key={index} className="text-center" variants={itemVariants}>
              <CountUp
                className="text-4xl md:text-5xl font-bold text-white mb-2"
                value={stat.value}
                isInView={isInView}
              />
              <motion.div
                className="text-blue-200"
                initial={{ opacity: 0 }}
                animate={{ opacity: isInView ? 1 : 0 }}
                transition={{ delay: 0.3 + index * 0.1, duration: 0.5 }}
              >
                {stat.label}
              </motion.div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}

// This component will count each number upwards to the target value, will show a different for other values that can't be added upwards.
function CountUp({ value, isInView, className }: { value: string; isInView: boolean; className: string }) {
  const [displayValue, setDisplayValue] = useState("")

  useEffect(() => {
    if (!isInView) return

    // Handle different formats: numbers with suffixes, percentages, and special formats
    if (value.includes("K+")) {
      // For values like "600K+"
      const numericValue = Number.parseInt(value.replace("K+", ""))
      let count = 0
      const interval = setInterval(() => {
        count += Math.ceil(numericValue / 30)
        if (count >= numericValue) {
          clearInterval(interval)
          setDisplayValue(`${numericValue}K+`)
        } else {
          setDisplayValue(`${count}K+`)
        }
      }, 30)

      return () => clearInterval(interval)
    } else if (value.includes("%")) {
      // For percentage values like "95%"
      const numericValue = Number.parseInt(value.replace("%", ""))
      let count = 0
      const interval = setInterval(() => {
        count += Math.ceil(numericValue / 25)
        if (count >= numericValue) {
          clearInterval(interval)
          setDisplayValue(`${numericValue}%`)
        } else {
          setDisplayValue(`${count}%`)
        }
      }, 40)

      return () => clearInterval(interval)
    } else if (value.includes("-")) {
      // For ranges like "3-5x"
      setDisplayValue(value)
    } else {
      // For other formats like "24/7"
      setDisplayValue(value)
    }
  }, [isInView, value])

  return <div className={className}>{displayValue}</div>
}

