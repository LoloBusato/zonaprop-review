import { put, list, get } from "@vercel/blob"
import { NextRequest, NextResponse } from "next/server"
import type { Property } from "@/lib/types"
import { getPropertiesBlobName, getAuthenticatedUser } from "@/lib/blob-helpers"

async function getPropertiesBlob(username: string): Promise<{
  data: Property[]
  pathname: string | null
}> {
  const blobName = getPropertiesBlobName(username)
  try {
    const { blobs } = await list({ prefix: blobName })
    if (blobs.length > 0) {
      const result = await get(blobs[0].pathname, { access: "private", useCache: false })
      if (result) {
        const text = await new Response(result.stream).text()
        return { data: JSON.parse(text), pathname: blobs[0].pathname }
      }
    }
  } catch (error) {
    console.error("[properties] Error fetching:", error)
  }
  return { data: [], pathname: null }
}

export async function GET() {
  const username = await getAuthenticatedUser()
  if (!username) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { data } = await getPropertiesBlob(username)
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in GET /api/properties:", error)
    return NextResponse.json({ error: "Failed to fetch properties" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const username = await getAuthenticatedUser()
  if (!username) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const properties: Property[] = await request.json()
    const blobName = getPropertiesBlobName(username)

    const result = await put(blobName, JSON.stringify(properties, null, 2), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
    })

    return NextResponse.json({ ok: true, pathname: result.pathname })
  } catch (error) {
    console.error("[properties] Error in POST:", error)
    return NextResponse.json({ error: "Failed to save properties" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const username = await getAuthenticatedUser()
  if (!username) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const update: { id: string; status?: string; notes?: string; price?: number | null; area?: number | null } = await request.json()
    const { data: properties } = await getPropertiesBlob(username)

    const idx = properties.findIndex((p) => p.id === update.id)
    if (idx === -1) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 })
    }

    if (update.status !== undefined) {
      properties[idx].status = update.status as Property["status"]
    }
    if (update.notes !== undefined) {
      properties[idx].notes = update.notes
    }
    if (update.price !== undefined) {
      properties[idx].price = update.price
      properties[idx].pricePerM2 = update.price && properties[idx].area
        ? Math.round(update.price / properties[idx].area)
        : null
    }
    if (update.area !== undefined) {
      properties[idx].area = update.area
      properties[idx].pricePerM2 = properties[idx].price && update.area
        ? Math.round(properties[idx].price / update.area)
        : null
    }

    const blobName = getPropertiesBlobName(username)
    await put(blobName, JSON.stringify(properties, null, 2), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
    })

    return NextResponse.json({ ok: true, property: properties[idx] })
  } catch (error) {
    console.error("[properties] Error in PATCH:", error)
    return NextResponse.json({ error: "Failed to update property" }, { status: 500 })
  }
}
