"use client"

import { useState, useEffect, useCallback } from "react"
import { LoginForm } from "@/components/login-form"
import { UploadZone } from "@/components/upload-zone"
import { PropertyGrid } from "@/components/property-grid"

export default function Home() {
  const [username, setUsername] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [hasData, setHasData] = useState<boolean | null>(null)
  const [showScraper, setShowScraper] = useState(false)

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated) setUsername(data.username)
      })
      .catch(() => {})
      .finally(() => setAuthLoading(false))
  }, [])

  const checkForData = useCallback(async () => {
    try {
      const response = await fetch("/api/properties")
      if (response.status === 401) {
        setHasData(false)
        return
      }
      const data = await response.json()
      setHasData(Array.isArray(data) && data.length > 0)
      setShowScraper(false)
    } catch {
      setHasData(false)
    }
  }, [])

  useEffect(() => {
    if (username) checkForData()
  }, [username, checkForData])

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" })
    setUsername(null)
    setHasData(null)
    setShowScraper(false)
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!username) {
    return <LoginForm onLogin={(name) => setUsername(name)} />
  }

  if (hasData === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!hasData || showScraper) {
    return <UploadZone onUploadComplete={checkForData} username={username} onLogout={handleLogout} />
  }

  return <PropertyGrid username={username} onLogout={handleLogout} onGoToScraper={() => setShowScraper(true)} />
}
