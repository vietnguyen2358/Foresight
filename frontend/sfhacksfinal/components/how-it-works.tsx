import Image from "next/image"

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

  return (
    <div className="py-24 bg-black">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">How It Works</h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Our technology transforms raw video data into actionable intelligence for search and rescue operations.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="order-2 lg:order-1">
            <div className="space-y-12">
              {steps.map((step, index) => (
                <div key={index} className="flex">
                  <div className="mr-6">
                    <div className="w-12 h-12 rounded-full bg-blue-900 flex items-center justify-center text-blue-300 font-bold">
                      {step.number}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-2">{step.title}</h3>
                    <p className="text-gray-400">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="order-1 lg:order-2 relative">
            <div className="relative h-[500px] rounded-lg overflow-hidden border border-gray-800 shadow-xl">
              <Image
                src="/placeholder.svg?height=1000&width=800"
                alt="REPLACE WITH ACTUAL EXAMPLE IMAGE"
                fill
                className="object-cover"
              />

              {/* Overlay with tech elements */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
              <div className="absolute inset-0 flex flex-col justify-between p-6">
                <div className="flex justify-between items-start">
                  <div className="bg-black/70 rounded px-3 py-1 text-sm text-blue-400 border border-blue-900">
                    Camera Feed #142
                  </div>
                  <div className="bg-black/70 rounded px-3 py-1 text-sm text-green-400 border border-green-900">
                    Processing Active
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-black/80 rounded p-3 border border-gray-700">
                    <div className="text-xs text-gray-400 mb-1">AI Detection</div>
                    <div className="text-sm text-white">3 individuals detected in current frame</div>
                  </div>

                  <div className="bg-black/80 rounded p-3 border border-blue-900">
                    <div className="text-xs text-blue-400 mb-1">Generated Description</div>
                    <div className="text-sm text-white">Male, blue jacket, black backpack, near bus stop</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Decorative elements */}
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-blue-500/10 rounded-full blur-xl"></div>
            <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-blue-500/10 rounded-full blur-xl"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

