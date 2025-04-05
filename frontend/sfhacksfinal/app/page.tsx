import Hero from "@/components/hero"
import Features from "@/components/features"
import HowItWorks from "@/components/ourSolution"
import Stats from "@/components/stats"
import CTA from "@/components/cta"

export default function Home() {
  return (
    <div className="flex flex-col items-center">
      <Hero />
      <Features />
      <HowItWorks />
      <Stats />
      <CTA />
    </div>
  )
}

