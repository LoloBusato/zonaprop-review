import { put, list, get } from "@vercel/blob"
import { NextRequest, NextResponse } from "next/server"
import type { Property } from "@/lib/types"

const BLOB_FILENAME = "propiedades.json"

async function getPropertiesBlob(): Promise<{
  data: Property[]
  pathname: string | null
}> {
  try {
    const { blobs } = await list({ prefix: BLOB_FILENAME })
    console.log("[v0] Found blobs:", blobs.length)
    if (blobs.length > 0) {
      // For private blobs, use get() to read the content
      const result = await get(blobs[0].pathname, { access: "private" })
      if (result) {
        const text = await new Response(result.stream).text()
        return { data: JSON.parse(text), pathname: blobs[0].pathname }
      }
    }
  } catch (error) {
    console.error("[v0] Error fetching properties:", error)
  }
  return { data: [], pathname: null }
}

export async function GET() {
  try {
    const { data } = await getPropertiesBlob()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in GET /api/properties:", error)
    return NextResponse.json({ error: "Failed to fetch properties" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const properties: Property[] = await request.json()
    console.log("[v0] POST /api/properties - Saving", properties.length, "properties")

    const result = await put(BLOB_FILENAME, JSON.stringify(properties, null, 2), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
    })
    console.log("[v0] Blob put result:", result.pathname)

    return NextResponse.json({ ok: true, pathname: result.pathname })
  } catch (error) {
    console.error("[v0] Error in POST /api/properties:", error)
    return NextResponse.json({ error: "Failed to save properties" }, { status: 500 })
  }
}

// PATCH - Update a single property by ID (prevents overwrite conflicts)
export async function PATCH(request: NextRequest) {
  try {
    const update: { id: string; status?: string; notes?: string } = await request.json()
    console.log("[v0] PATCH /api/properties - Updating property:", update.id)

    // Get current data
    const { data: properties } = await getPropertiesBlob()
    
    // Find and update the property
    const idx = properties.findIndex((p) => p.id === update.id)
    if (idx === -1) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 })
    }

    // Only update the fields that were provided
    if (update.status !== undefined) {
      properties[idx].status = update.status as Property["status"]
    }
    if (update.notes !== undefined) {
      properties[idx].notes = update.notes
    }

    // Save back
    const result = await put(BLOB_FILENAME, JSON.stringify(properties, null, 2), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
    })
    console.log("[v0] PATCH saved, pathname:", result.pathname)

    return NextResponse.json({ ok: true, property: properties[idx] })
  } catch (error) {
    console.error("[v0] Error in PATCH /api/properties:", error)
    return NextResponse.json({ error: "Failed to update property" }, { status: 500 })
  }
}
