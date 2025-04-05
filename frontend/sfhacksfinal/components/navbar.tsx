"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Menu, X } from "lucide-react"
import { usePathname } from "next/navigation"
import WatchdogLogo from "./logo"

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()

  const navItems = [{ name: "Dashboard", href: "/dashboard" }]

  const isActive = (path: string) => {
    return pathname === path
  }

  // // Track scroll position to add extra styling when scrolled
  // useEffect(() => {
  //   const handleScroll = () => {
  //     if (window.scrollY > 10) {
  //       setScrolled(true)
  //     } else {
  //       setScrolled(false)
  //     }
  //   }
  //   window.addEventListener("scroll", handleScroll)
  //   handleScroll()
  //   return () => {
  //     window.removeEventListener("scroll", handleScroll)
  //   }
  // }, [])

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-gray-950/85 backdrop-blur-md border-gray-800/70 shadow-lg"
          : "bg-gray-950/70 backdrop-blur-sm border-gray-800/50"
      } border-b`}
    >
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <WatchdogLogo size={40} className="mr-2" maxMovement={5} />
              <span className="text-white font-bold text-xl">Watchdog</span>
            </Link>
          </div>

          {/* Desktop menu */}
          <div className="hidden md:flex items-center space-x-4">
            <div className="flex space-x-4">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    isActive(item.href)
                      ? "bg-blue-700/90 text-white"
                      : "text-gray-300 hover:bg-gray-800/70 hover:text-white"
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </div>
            <Button asChild className="ml-4 bg-blue-600/90 hover:bg-blue-700">
              <Link href="/dashboard">Emergency Call</Link>
            </Button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-300 hover:text-white focus:outline-none"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-gray-900/95 backdrop-blur-md pb-4 px-4">
          <div className="flex flex-col space-y-2 pt-2">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`px-3 py-2 rounded-md text-base font-medium ${
                  isActive(item.href)
                    ? "bg-blue-700/90 text-white"
                    : "text-gray-300 hover:bg-gray-800/70 hover:text-white"
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}
            <Button asChild className="mt-4 bg-blue-600/90 hover:bg-blue-700">
              <Link href="/dashboard">Emergency Call</Link>
            </Button>
          </div>
        </div>
      )}
    </nav>
  )
}

