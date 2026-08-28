"use client"

import { useState, useEffect, useRef } from "react"
import { Upload, FileUp, AlertCircle, CheckCircle2, LogOut, SlidersHorizontal, Play, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FiltersDialog } from "@/components/filters-dialog"
import { buildSearchUrl, type SearchFilters } from "@/lib/filters"

interface UploadZoneProps {
  onUploadComplete: () => void
  username: string
  onLogout: () => void
}

export function UploadZone({ onUploadComplete, username, onLogout }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mergeInfo, setMergeInfo] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [scraperUrl, setScraperUrl] = useState<string | null>(null)
  const [scraping, setScraping] = useState(false)
  const [scraperMessage, setScraperMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetch("/api/filters")
      .then((r) => r.json())
      .then((data: SearchFilters) => {
        setScraperUrl(buildSearchUrl(data))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
  }, [])

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) await uploadFile(file)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await uploadFile(file)
  }

  const uploadFile = async (file: File) => {
    if (!file.name.endsWith(".json")) {
      setError("Please upload a JSON file")
      return
    }

    setIsUploading(true)
    setError(null)
    setMergeInfo(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.details || data.error || "Upload failed")
      }

      if (data.kept > 0 || data.removed > 0) {
        setMergeInfo(
          `Merged: ${data.count} total — ${data.new} new, ${data.kept} preserved, ${data.removed} removed`
        )
      }

      setTimeout(() => onUploadComplete(), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload file. Please try again.")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleFiltersApplied = (_filters: SearchFilters, url: string) => {
    setScraperUrl(url)
  }

  const runScraper = async () => {
    setScraping(true)
    setError(null)
    setScraperMessage(null)

    try {
      const response = await fetch("/api/scraper-script")
      const script = await response.text()
      await navigator.clipboard.writeText(script)

      if (scraperUrl) {
        window.open(scraperUrl, "_blank")
      }

      setScraperMessage("Script copied! Paste it in the browser console on ZonaProp (F12 → Ctrl+V → Enter). Data will sync automatically.")

      startPolling()
    } catch {
      setError("Failed to copy scraper script.")
      setScraping(false)
    }
  }

  const startPolling = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)

    let checks = 0
    pollIntervalRef.current = setInterval(async () => {
      checks++
      try {
        const response = await fetch("/api/scraper-status")
        const data = await response.json()
        if (data.hasData) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
          setScraping(false)
          setScraperMessage(null)
          onUploadComplete()
        }
      } catch {}

      if (checks >= 120) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
        setScraping(false)
        setScraperMessage("Polling timed out. If the scraper finished, refresh the page.")
      }
    }, 5000)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
      <div className="absolute top-4 right-4 flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{username}</span>
        <Button variant="ghost" size="sm" onClick={onLogout}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>

      <div className="w-full max-w-md space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">
            ZonaProp Review
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure your search filters and run the scraper to load properties.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setFiltersOpen(true)}
          >
            <SlidersHorizontal className="mr-1.5 h-4 w-4" />
            Change Filters
          </Button>
          <Button
            size="default"
            onClick={runScraper}
            disabled={scraping}
          >
            {scraping ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-1.5 h-4 w-4" />
            )}
            {scraping ? "Waiting for data..." : "Run Scraper"}
          </Button>
        </div>

        {/* Scraper status message */}
        {scraperMessage && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-left text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
            {scraperMessage}
          </div>
        )}

        {/* Instructions */}
        <div className="space-y-2 rounded-lg bg-muted p-4 text-left text-xs text-muted-foreground">
          <p className="font-medium text-foreground">How it works:</p>
          <ol className="list-inside list-decimal space-y-1">
            <li><strong>Change Filters</strong> to configure your search (barrios, price, area)</li>
            <li>Click <strong>Run Scraper</strong> — it opens ZonaProp and copies the script</li>
            <li>Paste the script in the browser console (F12 → Ctrl+V → Enter)</li>
            <li>Wait for scraping to finish — results sync back automatically</li>
          </ol>
        </div>

        {/* Upload zone (fallback) */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Or upload a JSON file manually:</p>
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-lg border-2 border-dashed p-8 transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-muted/50"
            }`}
          >
            <div className="flex flex-col items-center gap-3">
              {isUploading ? (
                <FileUp className="h-8 w-8 animate-pulse text-primary" />
              ) : (
                <Upload className="h-8 w-8 text-muted-foreground" />
              )}
              <p className="text-xs text-muted-foreground">
                {isUploading ? "Uploading..." : "Drop JSON here or click to browse"}
              </p>
            </div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          className="hidden"
        />

        {error && (
          <div className="flex items-center justify-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {mergeInfo && (
          <div className="flex items-center justify-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            {mergeInfo}
          </div>
        )}
      </div>

      <FiltersDialog
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        onFiltersApplied={handleFiltersApplied}
      />
    </div>
  )
}
