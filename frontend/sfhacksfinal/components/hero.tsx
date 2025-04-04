import { Button } from "@/components/ui/button"
import Link from "next/link"
import Image from "next/image"

export default function Hero() {
  return (
    <div className="relative bg-black overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-black z-0"></div>
      <div className="absolute inset-0 bg-[url('/placeholder.svg?height=100&width=100')] bg-repeat opacity-5 z-0"></div>

      <div className="container mx-auto px-4 py-24 relative z-10">
        <div className="flex flex-col lg:flex-row items-center">
          <div className="lg:w-1/2 mb-12 lg:mb-0">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
              AI-Powered <span className="text-blue-500">Search & Rescue</span> for Urban Environments
            </h1>

            <p className="text-xl text-gray-300 mb-8 max-w-2xl">
              Leveraging computer vision and natural language understanding to help locate missing individuals in cities
              through intelligent video analysis.
            </p>

            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
              <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg">
                <Link href="/search">Start Searching</Link>
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-blue-600 text-blue-500 hover:bg-blue-900/20 text-lg"
              >
                <Link href="/about">Learn More</Link>
              </Button>
            </div>
          </div>

          <div className="lg:w-1/2 relative">
            <div className="relative w-full h-[400px] rounded-lg overflow-hidden shadow-2xl border border-gray-800">
              <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent z-10"></div>
              <Image
                src="/placeholder.svg?height=800&width=1200"
                alt="REPLACE WITH ACTUAL EXAMPLE IMAGE"
                fill
                className="object-cover"
              />

              {/* Overlay elements to make it look like an AI interface */}
              <div className="absolute inset-0 z-20">
                {/* Bounding boxes */}
                <div className="absolute top-[30%] left-[20%] w-[100px] h-[200px] border-2 border-blue-500 rounded-md opacity-70 animate-pulse"></div>
                <div className="absolute top-[40%] right-[30%] w-[80px] h-[180px] border-2 border-blue-500 rounded-md opacity-70"></div>

                {/* Labels */}
                <div className="absolute top-[25%] left-[20%] bg-blue-900/80 text-white text-xs px-2 py-1 rounded">
                  Person: 98%
                </div>
                <div className="absolute top-[35%] right-[30%] bg-blue-900/80 text-white text-xs px-2 py-1 rounded">
                  Person: 95%
                </div>

                {/* Data visualization elements */}
                <div className="absolute bottom-4 left-4 right-4 bg-black/70 p-3 rounded-md border border-gray-700">
                  <div className="text-xs text-gray-300 mb-1">AI Analysis</div>
                  <div className="text-sm text-white">Woman with red jacket near Market St, timestamp: 14:32:05</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

