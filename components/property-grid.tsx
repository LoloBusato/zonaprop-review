"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Image from "next/image"
import { Star, X, ExternalLink, Download, FileDown, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Property } from "@/lib/types"

interface PropertyGridProps {
  onReset: () => void
}

type SortKey = "pricePerM2" | "pricePerM2-desc" | "price" | "price-desc" | "area-desc" | "rooms-desc"
type FilterStatus = "all" | "pending" | "favorite" | "rejected" | "removed"

export function PropertyGrid({ onReset }: PropertyGridProps) {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("pending")
  const [sortKey, setSortKey] = useState<SortKey>("pricePerM2")
  const [maxPM2, setMaxPM2] = useState(5000)
  const [saving, setSaving] = useState(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const savePropertyUpdate = useCallback(async (id: string, update: { status?: string; notes?: string }) => {
    setSaving(true)
    console.log("[v0] Updating property:", id, update)
    try {
      const response = await fetch("/api/properties", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...update }),
      })
      const result = await response.json()
      console.log("[v0] Update response:", result)
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

    // Filter out properties over budget
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
    let list = filter
      ? properties.filter((p) => p.status === filter)
      : properties
    const headers = [
      "Status",
      "Precio USD",
      "Area m2",
      "USD/m2",
      "Ambientes",
      "Direccion",
      "Notas",
      "URL",
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
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `zonaprop_${filter || "all"}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
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
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onReset}
            >
              <Upload className="mr-1.5 h-4 w-4" />
              New
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => exportCSV()}
            >
              <Download className="mr-1.5 h-4 w-4" />
              Export CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => exportCSV("favorite")}
            >
              <FileDown className="mr-1.5 h-4 w-4" />
              Export Favorites
            </Button>
          </div>
        </div>
      </header>

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
                      {property.area ? `${property.area} m\u00b2` : "-"}
                    </strong>
                  </span>
                  <span>
                    USD/m\u00b2:{" "}
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
    </div>
  )
}
