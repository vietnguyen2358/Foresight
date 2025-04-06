import { ThemeProvider } from '@/components/theme-provider'
import { CameraProvider } from '@/lib/CameraContext'
import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { Toaster } from 'react-hot-toast'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <CameraProvider>
        <Component {...pageProps} />
        <Toaster position="bottom-right" />
      </CameraProvider>
    </ThemeProvider>
  )
} 