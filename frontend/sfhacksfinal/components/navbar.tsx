"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Menu, X } from "lucide-react"
import { usePathname } from "next/navigation"

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const pathname = usePathname()

  const navItems = [
    { name: "Dashboard", href: "/dashboard" },
  ]

  const isActive = (path: string) => {
    return pathname === path
  }

  return (
    <nav className="bg-gray-950 border-b border-gray-800">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <div className="w-10 h-10 rounded-md bg-blue-600 flex items-center justify-center mr-2">
                <span className="text-white font-bold text-xl">F&S</span>
              </div>
              <span className="text-white font-bold text-xl">Find & Seek</span>
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-4">
            <div className="flex space-x-4">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    isActive(item.href) ? "bg-blue-700 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white"
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </div>
            <Button className="ml-4 bg-blue-600 hover:bg-blue-700">Emergency Search</Button>
          </div>

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

      {isMenuOpen && (
        <div className="md:hidden bg-gray-900 pb-4 px-4">
          <div className="flex flex-col space-y-2 pt-2">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`px-3 py-2 rounded-md text-base font-medium ${
                  isActive(item.href) ? "bg-blue-700 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}
            <Button className="mt-4 bg-blue-600 hover:bg-blue-700">Emergency Search</Button>
          </div>
        </div>
      )}
    </nav>
  )
}

