import { put, list, get } from "@vercel/blob"
import { NextRequest, NextResponse } from "next/server"
import { getFiltersBlobName, getAuthenticatedUser } from "@/lib/blob-helpers"
import { DEFAULT_FILTERS, type SearchFilters } from "@/lib/filters"

export async function GET() {
  const username = await getAuthenticatedUser()
  if (!username) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const blobName = getFiltersBlobName(username)
  try {
    const { blobs } = await list({ prefix: blobName })
    if (blobs.length > 0) {
      const result = await get(blobs[0].pathname, { access: "private", useCache: false })
      if (result) {
        const text = await new Response(result.stream).text()
        return NextResponse.json(JSON.parse(text))
      }
    }
  } catch (error) {
    console.error("[filters] Error fetching:", error)
  }

  return NextResponse.json(DEFAULT_FILTERS)
}

export async function POST(request: NextRequest) {
  const username = await getAuthenticatedUser()
  if (!username) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const filters: SearchFilters = await request.json()
    const blobName = getFiltersBlobName(username)

    await put(blobName, JSON.stringify(filters, null, 2), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[filters] Error saving:", error)
    return NextResponse.json({ error: "Failed to save filters" }, { status: 500 })
  }
}
