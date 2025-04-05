import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function CTA() {
  return (
    <div className="py-24 bg-black">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to transform search and rescue operations?
          </h2>

          <p className="text-xl text-gray-300 mb-8">
            Join us in our mission to leverage AI for finding missing individuals faster and more efficiently in urban
            environments.
          </p>

          <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
            <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg">
              <Link href="/search">Start Using Find & Seek</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

