"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { BARRIOS, buildSearchUrl, type SearchFilters, DEFAULT_FILTERS } from "@/lib/filters"

interface FiltersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onFiltersApplied: (filters: SearchFilters, url: string) => void
}

export function FiltersDialog({ open, onOpenChange, onFiltersApplied }: FiltersDialogProps) {
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      fetch("/api/filters")
        .then((r) => r.json())
        .then((data) => setFilters(data))
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [open])

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

  const handleApply = async () => {
    setSaving(true)
    try {
      await fetch("/api/filters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filters),
      })
      const url = buildSearchUrl(filters)
      onFiltersApplied(filters, url)
      onOpenChange(false)
    } catch (error) {
      console.error("Error saving filters:", error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Change Filters</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading filters...</div>
        ) : (
          <div className="space-y-6">
            {/* Apto Credito */}
            <div className="flex items-center justify-between">
              <Label htmlFor="apto-credito" className="text-sm font-medium">
                Apto Crédito
              </Label>
              <Switch
                id="apto-credito"
                checked={filters.aptoCredito}
                onCheckedChange={(checked) =>
                  setFilters((prev) => ({ ...prev, aptoCredito: checked }))
                }
              />
            </div>

            {/* Price filters */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Price (USD)</Label>
              <div className="flex items-center gap-3">
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
                  className="h-9"
                />
                <span className="text-muted-foreground">to</span>
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
                  className="h-9"
                />
              </div>
            </div>

            {/* Area filters */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Area (m²)</Label>
              <div className="flex items-center gap-3">
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
                  className="h-9"
                />
                <span className="text-muted-foreground">to</span>
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
                  className="h-9"
                />
              </div>
            </div>

            {/* Barrios */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Barrios ({filters.barrios.length} selected)
                </Label>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={selectAllBarrios}>
                    Select all
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearAllBarrios}>
                    Clear
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-48 rounded-md border p-3">
                <div className="grid grid-cols-2 gap-2">
                  {BARRIOS.map((barrio) => (
                    <div key={barrio.slug} className="flex items-center gap-2">
                      <Checkbox
                        id={barrio.slug}
                        checked={filters.barrios.includes(barrio.slug)}
                        onCheckedChange={() => toggleBarrio(barrio.slug)}
                      />
                      <label
                        htmlFor={barrio.slug}
                        className="text-sm cursor-pointer"
                      >
                        {barrio.label}
                      </label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={saving || loading}>
            {saving ? "Saving..." : "OK"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
