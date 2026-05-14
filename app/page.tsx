"use client"

import { useState, useEffect, useCallback } from "react"
import { UploadZone } from "@/components/upload-zone"
import { PropertyGrid } from "@/components/property-grid"

export default function Home() {
  const [hasData, setHasData] = useState<boolean | null>(null)

  const checkForData = useCallback(async () => {
    try {
      const response = await fetch("/api/properties")
      const data = await response.json()
      setHasData(Array.isArray(data) && data.length > 0)
    } catch {
      setHasData(false)
    }
  }, [])

  useEffect(() => {
    checkForData()
  }, [checkForData])

  if (hasData === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!hasData) {
    return <UploadZone onUploadComplete={checkForData} />
  }

  return <PropertyGrid onReset={() => setHasData(false)} />
}
