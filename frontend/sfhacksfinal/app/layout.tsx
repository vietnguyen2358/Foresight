import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { CameraProvider } from "@/lib/CameraContext"
import Navbar from "@/components/navbar"


const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Foresight | AI-Powered Search and Rescue",
  description:
    "Real-time, city-scale search and rescue tool leveraging AI-powered video analysis to help locate missing individuals in urban environments.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: { url: "/apple-touch-icon.png" },
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css"
          integrity="sha512-xodZBNTC5n17Xt2atTPuE1HxjVMSvLVW9ocqUKLsCC5CXdbqCmblAshOMAS6/keqq/sMZMZ19scR4PsZChSR7A=="
          crossOrigin=""
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <CameraProvider>
            <div className="flex min-h-screen flex-col bg-black">
              <Navbar />
              <div className="h-16"></div>
              <div className="flex-1 flex">
                {/* Main Content */}
                <div className="flex-1 bg-gray-950">
                  <main className="h-full">
                    {children}
                  </main>
                </div>
              </div>
            </div>
          </CameraProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

