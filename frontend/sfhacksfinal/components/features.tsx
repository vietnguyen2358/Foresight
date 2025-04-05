"use client"

import { Camera, Search, Database, Map } from "lucide-react"
import { motion } from "framer-motion"

export default function Features() {
  const features = [
    {
      icon: <Camera className="h-10 w-10 text-blue-500" />,
      title: "Real-Time CCTV Processing",
      description:
        "Process public or pre-recorded CCTV footage using computer vision to detect and track individuals across frames.",
    },
    {
      icon: <Search className="h-10 w-10 text-blue-500" />,
      title: "AI-Generated Descriptions",
      description:
        "Generate natural language descriptions of individuals based on visual features like clothing, accessories, and estimated attributes.",
    },
    {
      icon: <Database className="h-10 w-10 text-blue-500" />,
      title: "Searchable Database",
      description:
        "Store AI-generated descriptions with references to corresponding video frames for quick retrieval and analysis.",
    },
    {
      icon: <Map className="h-10 w-10 text-blue-500" />,
      title: "Location Mapping",
      description: "Visualize sightings on a map to track movement patterns and identify potential search areas.",
    },
  ]

  return (
    <div className="bg-gray-950 py-24">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Key Features</h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Our platform combines cutting-edge AI technologies to transform how we search for missing individuals in
            urban environments.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              className="bg-gray-900 rounded-lg p-8 border border-gray-800 hover:border-blue-600 transition-colors duration-300"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{
                duration: 0.5,
                delay: index * 0.1,
                ease: "easeOut",
              }}
            >
              <div className="mb-6 flex justify-center">{feature.icon}</div>
              <h3 className="text-xl font-semibold text-white mb-4 text-center">{feature.title}</h3>
              <p className="text-gray-400 text-center">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

