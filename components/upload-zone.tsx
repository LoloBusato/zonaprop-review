"use client"

import { useState, useRef } from "react"
import { Upload, FileUp, AlertCircle, CheckCircle2, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"

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
  const fileInputRef = useRef<HTMLInputElement>(null)

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
            Upload your JSON file to review apartments. Your existing reviews will be preserved.
          </p>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-lg border-2 border-dashed p-12 transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/50"
          }`}
        >
          <div className="flex flex-col items-center gap-4">
            {isUploading ? (
              <FileUp className="h-12 w-12 animate-pulse text-primary" />
            ) : (
              <Upload className="h-12 w-12 text-muted-foreground" />
            )}
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                {isUploading ? "Uploading..." : "Drop your JSON file here"}
              </p>
              <p className="text-xs text-muted-foreground">
                or click to browse
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

        <div className="space-y-2 rounded-lg bg-muted p-4 text-left text-xs text-muted-foreground">
          <p className="font-medium text-foreground">How to get your data:</p>
          <ol className="list-inside list-decimal space-y-1">
            <li>Open ZonaProp search results in your browser</li>
            <li>Run the scraper.js script in the console</li>
            <li>Download the propiedades.json file</li>
            <li>Upload it here</li>
          </ol>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          Select File
        </Button>
      </div>
    </div>
  )
}
