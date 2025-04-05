import Hero from "@/components/hero"
import Features from "@/components/features"
import HowItWorks from "@/components/how-it-works"
import Stats from "@/components/stats"
import CTA from "@/components/cta"
import { CameraFeed } from "@/components/CameraFeed"

export default function Home() {
  return (
    <div className="flex flex-col items-center">
      <Hero />
      <div className="w-full max-w-4xl mx-auto my-8">
        <h2 className="text-3xl font-bold text-center mb-6">Live Camera Feed</h2>
        <CameraFeed />
      </div>
      <Features />
      <HowItWorks />
      <Stats />
      <CTA />
    </div>
  )
}

