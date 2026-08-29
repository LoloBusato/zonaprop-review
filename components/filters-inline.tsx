"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { BARRIOS, buildSearchUrl, type SearchFilters, DEFAULT_FILTERS } from "@/lib/filters"

interface FiltersInlineProps {
  onFiltersChanged: (filters: SearchFilters, url: string) => void
}

export function FiltersInline({ onFiltersChanged }: FiltersInlineProps) {
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/filters")
      .then((r) => r.json())
      .then((data) => setFilters(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const toggleBarrio = (slug: string) => {
    setFilters((prev) => ({
      ...prev,
      barrios: prev.barrios.includes(slug)
        ? prev.barrios.filter((b) => b !== slug)
        : [...prev.barrios, slug],
    }))
  }

  const selectAllBarrios = () => {
    setFilters((prev) => ({ ...prev, barrios: BARRIOS.map((b) => b.slug) }))
  }

  const clearAllBarrios = () => {
    setFilters((prev) => ({ ...prev, barrios: [] }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch("/api/filters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filters),
      })
      const url = buildSearchUrl(filters)
      onFiltersChanged(filters, url)
    } catch (error) {
      console.error("Error saving filters:", error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="py-4 text-center text-sm text-muted-foreground">Loading filters...</div>
  }

  return (
    <div className="space-y-4 rounded-lg border p-4 text-left">
      <h3 className="text-sm font-semibold text-foreground">Search Filters</h3>

      {/* Apto Credito */}
      <div className="flex items-center justify-between">
        <Label htmlFor="apto-credito-inline" className="text-sm">
          Apto Crédito
        </Label>
        <Switch
          id="apto-credito-inline"
          checked={filters.aptoCredito}
          onCheckedChange={(checked) =>
            setFilters((prev) => ({ ...prev, aptoCredito: checked }))
          }
        />
      </div>

      {/* Price */}
      <div className="space-y-1">
        <Label className="text-sm">Price (USD)</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder="Min"
            value={filters.minPrice ?? ""}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                minPrice: e.target.value ? parseInt(e.target.value) : null,
              }))
            }
            className="h-8"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="number"
            placeholder="Max"
            value={filters.maxPrice ?? ""}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                maxPrice: e.target.value ? parseInt(e.target.value) : null,
              }))
            }
            className="h-8"
          />
        </div>
      </div>

      {/* Area */}
      <div className="space-y-1">
        <Label className="text-sm">Area (m²)</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder="Min"
            value={filters.minArea ?? ""}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                minArea: e.target.value ? parseInt(e.target.value) : null,
              }))
            }
            className="h-8"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="number"
            placeholder="Max"
            value={filters.maxArea ?? ""}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                maxArea: e.target.value ? parseInt(e.target.value) : null,
              }))
            }
            className="h-8"
          />
        </div>
      </div>

      {/* Barrios */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-sm">
            Barrios ({filters.barrios.length})
          </Label>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={selectAllBarrios}>
              All
            </Button>
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={clearAllBarrios}>
              Clear
            </Button>
          </div>
        </div>
        <ScrollArea className="h-36 rounded-md border p-2">
          <div className="grid grid-cols-2 gap-1.5">
            {BARRIOS.map((barrio) => (
              <div key={barrio.slug} className="flex items-center gap-1.5">
                <Checkbox
                  id={`inline-${barrio.slug}`}
                  checked={filters.barrios.includes(barrio.slug)}
                  onCheckedChange={() => toggleBarrio(barrio.slug)}
                  className="h-3.5 w-3.5"
                />
                <label
                  htmlFor={`inline-${barrio.slug}`}
                  className="text-xs cursor-pointer"
                >
                  {barrio.label}
                </label>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <Button onClick={handleSave} disabled={saving} size="sm" className="w-full">
        {saving ? "Saving..." : "Save Filters"}
      </Button>
    </div>
  )
}
