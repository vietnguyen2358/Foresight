"use client"

import { createContext, useContext, useState, ReactNode } from 'react'

export interface Camera {
  id: string
  name: string
  lat: number
  lng: number
  status: string
}

interface CameraContextType {
  selectedCamera: Camera | null
  setSelectedCamera: (camera: Camera | null) => void
}

const CameraContext = createContext<CameraContextType | undefined>(undefined)

export function CameraProvider({ children }: { children: ReactNode }) {
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null)

  return (
    <CameraContext.Provider value={{ selectedCamera, setSelectedCamera }}>
      {children}
    </CameraContext.Provider>
  )
}

export function useCamera() {
  const context = useContext(CameraContext)
  if (context === undefined) {
    throw new Error('useCamera must be used within a CameraProvider')
  }
  return context
}