"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Image from "next/image"
import { Star, X, ExternalLink, Download, FileDown, LogOut, SlidersHorizontal, Play, Loader2, FileUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FiltersDialog } from "@/components/filters-dialog"
import type { Property } from "@/lib/types"
import { buildSearchUrl, type SearchFilters } from "@/lib/filters"

interface PropertyGridProps {
  username: string
  onLogout: () => void
}

type SortKey = "pricePerM2" | "pricePerM2-desc" | "price" | "price-desc" | "area-desc" | "rooms-desc"
type FilterStatus = "all" | "pending" | "favorite" | "rejected" | "removed"

export function PropertyGrid({ username, onLogout }: PropertyGridProps) {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("pending")
  const [sortKey, setSortKey] = useState<SortKey>("pricePerM2")
  const [maxPM2, setMaxPM2] = useState(5000)
  const [saving, setSaving] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [scraperUrl, setScraperUrl] = useState<string | null>(null)
  const [scraping, setScraping] = useState(false)
  const [scraperMessage, setScraperMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastPropertyCountRef = useRef<number>(0)

  const fetchProperties = useCallback(async () => {
    try {
      const response = await fetch("/api/properties")
      const data = await response.json()
      setProperties(data)
    } catch (error) {
      console.error("Error fetching properties:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProperties()
  }, [fetchProperties])

  useEffect(() => {
    lastPropertyCountRef.current = properties.length
  }, [properties.length])

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
  }, [])

  useEffect(() => {
    fetch("/api/filters")
      .then((r) => r.json())
      .then((data: SearchFilters) => {
        setScraperUrl(buildSearchUrl(data))
      })
      .catch(() => {})
  }, [])

  const savePropertyUpdate = useCallback(async (id: string, update: { status?: string; notes?: string }) => {
    setSaving(true)
    try {
      await fetch("/api/properties", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...update }),
      })
    } catch (error) {
      console.error("[v0] Error updating:", error)
    } finally {
      setSaving(false)
    }
  }, [])

  const toggleStatus = (id: string, status: "favorite" | "rejected") => {
    const property = properties.find((p) => p.id === id)
    if (!property) return
    const newStatus = property.status === status ? "pending" : status

    setProperties((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: newStatus } : p))
    )

    savePropertyUpdate(id, { status: newStatus })
  }

  const setNotes = (id: string, notes: string) => {
    setProperties((prev) =>
      prev.map((p) => (p.id === id ? { ...p, notes } : p))
    )
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = setTimeout(() => {
      savePropertyUpdate(id, { notes })
    }, 1000)
  }

  const getFilteredAndSorted = () => {
    let list = properties.filter(
      (p) => filterStatus === "all" || p.status === filterStatus
    )

    list = list.filter((p) => !p.pricePerM2 || p.pricePerM2 <= maxPM2)

    const desc = sortKey.endsWith("-desc")
    const key = sortKey.replace("-desc", "") as keyof Property

    list.sort((a, b) => {
      let va = a[key] as number | null
      let vb = b[key] as number | null
      if (va == null) va = desc ? -Infinity : Infinity
      if (vb == null) vb = desc ? -Infinity : Infinity
      return desc ? vb - va : va - vb
    })

    return list
  }

  const exportCSV = (filter?: "favorite") => {
    const list = filter
      ? properties.filter((p) => p.status === filter)
      : properties
    const headers = [
      "Status", "Precio USD", "Area m2", "USD/m2", "Ambientes", "Direccion", "Notas", "URL",
    ]
    const rows = list.map((p) => [
      p.status,
      p.price || "",
      p.area || "",
      p.pricePerM2 || "",
      p.rooms || "",
      `"${(p.address || "").replace(/"/g, '""')}"`,
      `"${(p.notes || "").replace(/"/g, '""')}"`,
      p.url || "",
    ])
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `zonaprop_${filter || "all"}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  const handleFiltersApplied = (_filters: SearchFilters, url: string) => {
    setScraperUrl(url)
  }

  const runScraper = async () => {
    setScraping(true)
    setScraperMessage(null)

    try {
      const response = await fetch("/api/scraper-script")
      const script = await response.text()
      await navigator.clipboard.writeText(script)

      if (scraperUrl) {
        window.open(scraperUrl, "_blank")
      }

      setScraperMessage("Script copied! Paste in console (F12 → Ctrl+V → Enter). Data syncs automatically.")

      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
      let checks = 0
      const initialCount = lastPropertyCountRef.current
      pollIntervalRef.current = setInterval(async () => {
        checks++
        try {
          const resp = await fetch("/api/scraper-status")
          const data = await resp.json()
          if (data.hasData && data.size > 0) {
            const propsResp = await fetch("/api/properties")
            const propsData = await propsResp.json()
            if (Array.isArray(propsData) && propsData.length > initialCount) {
              if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
              setProperties(propsData)
              setScraping(false)
              setScraperMessage(`Done! ${propsData.length - initialCount} new properties added.`)
              setTimeout(() => setScraperMessage(null), 5000)
            }
          }
        } catch {}
        if (checks >= 120) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
          setScraping(false)
          setScraperMessage("Polling timed out. Refresh the page if scraper finished.")
          setTimeout(() => setScraperMessage(null), 8000)
        }
      }, 5000)
    } catch {
      setScraping(false)
      setScraperMessage("Failed to copy scraper script.")
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const formData = new FormData()
      formData.append("file", file)
      const response = await fetch("/api/upload", { method: "POST", body: formData })
      const data = await response.json()
      if (response.ok) {
        alert(`Upload complete: ${data.count} total — ${data.new} new, ${data.kept} preserved, ${data.removed} removed`)
        fetchProperties()
      } else {
        alert("Upload failed: " + (data.error || "Unknown error"))
      }
    } catch {
      alert("Upload failed")
    }
    if (fileInputRef.current) fileInputRef.current.value = ""
  }


  const favCount = properties.filter((p) => p.status === "favorite").length
  const rejCount = properties.filter((p) => p.status === "rejected").length
  const pendCount = properties.filter((p) => p.status === "pending").length
  const progress = properties.length
    ? Math.round(((favCount + rejCount) / properties.length) * 100)
    : 0

  const filteredList = getFilteredAndSorted()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading properties...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card px-4 py-3 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-lg font-semibold text-foreground">
            ZonaProp Review - {properties.length} properties
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setFiltersOpen(true)}
            >
              <SlidersHorizontal className="mr-1.5 h-4 w-4" />
              Filters
            </Button>
            <Button
              size="sm"
              onClick={runScraper}
              disabled={scraping}
            >
              {scraping ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-1.5 h-4 w-4" />
              )}
              {scraping ? "Scraping..." : "Run Scraper"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp className="mr-1.5 h-4 w-4" />
              Upload JSON
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => exportCSV()}
            >
              <Download className="mr-1.5 h-4 w-4" />
              CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => exportCSV("favorite")}
            >
              <FileDown className="mr-1.5 h-4 w-4" />
              Favorites
            </Button>
            <span className="text-sm text-muted-foreground">{username}</span>
            <Button variant="ghost" size="sm" onClick={onLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>


      {/* Scraper status message */}
      {scraperMessage && (
        <div className="border-b border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
          {scraperMessage}
        </div>
      )}

      {/* Summary */}
      <div className="flex flex-wrap gap-4 border-b border-border bg-muted/50 px-4 py-2 text-sm sm:gap-6 sm:px-6">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground" />
          Pending: {pendCount}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
          Favorites: {favCount}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
          Rejected: {rejCount}
        </span>
        <span className="text-muted-foreground">Progress: {progress}%</span>
      </div>

      {/* Filters */}
      <div className="sticky top-[61px] z-40 flex flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-2 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Show:</span>
          <Select
            value={filterStatus}
            onValueChange={(v) => setFilterStatus(v as FilterStatus)}
          >
            <SelectTrigger className="h-8 w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="favorite">Favorites</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="removed">Removed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort:</span>
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger className="h-8 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pricePerM2">USD/m2 (low to high)</SelectItem>
              <SelectItem value="pricePerM2-desc">USD/m2 (high to low)</SelectItem>
              <SelectItem value="price">Price (low to high)</SelectItem>
              <SelectItem value="price-desc">Price (high to low)</SelectItem>
              <SelectItem value="area-desc">Area (high to low)</SelectItem>
              <SelectItem value="rooms-desc">Rooms (high to low)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Max USD/m2:</span>
          <Input
            type="number"
            value={maxPM2}
            onChange={(e) => setMaxPM2(parseInt(e.target.value) || 0)}
            className="h-8 w-[100px]"
          />
        </div>

        <span className="ml-auto text-sm text-muted-foreground">
          Showing {filteredList.length}
        </span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {filteredList.map((property) => {
          const pricePerM2 = property.pricePerM2
          const priceClass =
            pricePerM2 == null
              ? ""
              : pricePerM2 <= 1500
                ? "text-green-500"
                : pricePerM2 <= 2200
                  ? "text-yellow-500"
                  : "text-red-500"

          return (
            <div
              key={property.id}
              className={`overflow-hidden rounded-lg border-2 bg-card transition-all ${
                property.status === "favorite"
                  ? "border-green-500"
                  : property.status === "rejected"
                    ? "border-border opacity-30"
                    : "border-transparent hover:border-border"
              }`}
            >
              {/* Image */}
              <div className="relative aspect-[16/10] w-full bg-muted">
                {property.image ? (
                  <Image
                    src={property.image}
                    alt={property.address || "Property"}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No image
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="space-y-2 p-3">
                <p
                  className="truncate text-sm font-medium text-foreground"
                  title={property.address || ""}
                >
                  {property.address || "No address"}
                </p>

                <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                  <span>
                    Price:{" "}
                    <strong className="text-foreground">
                      {property.price
                        ? `USD ${property.price.toLocaleString()}`
                        : "-"}
                    </strong>
                  </span>
                  <span>
                    Area:{" "}
                    <strong className="text-foreground">
                      {property.area ? `${property.area} m²` : "-"}
                    </strong>
                  </span>
                  <span>
                    USD/m²:{" "}
                    <strong className={priceClass}>
                      {pricePerM2 ? `USD ${pricePerM2.toLocaleString()}` : "-"}
                    </strong>
                  </span>
                  <span>
                    Rooms:{" "}
                    <strong className="text-foreground">
                      {property.rooms || "-"}
                    </strong>
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    variant={property.status === "favorite" ? "default" : "outline"}
                    className={
                      property.status === "favorite"
                        ? "bg-green-600 hover:bg-green-700"
                        : ""
                    }
                    onClick={() => toggleStatus(property.id, "favorite")}
                  >
                    <Star className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant={property.status === "rejected" ? "default" : "outline"}
                    className={
                      property.status === "rejected"
                        ? "bg-red-600 hover:bg-red-700"
                        : ""
                    }
                    onClick={() => toggleStatus(property.id, "rejected")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  {property.url && (
                    <a
                      href={property.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto"
                    >
                      <Button size="sm" variant="outline">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                  )}
                </div>

                {/* Notes */}
                <Input
                  placeholder="Notes..."
                  value={property.notes || ""}
                  onChange={(e) => setNotes(property.id, e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          )
        })}
      </div>

      {filteredList.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <p>No properties found</p>
          <p className="text-sm">Try adjusting your filters</p>
        </div>
      )}

      {/* Filters Dialog */}
      <FiltersDialog
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        onFiltersApplied={handleFiltersApplied}
      />
    </div>
  )
}
