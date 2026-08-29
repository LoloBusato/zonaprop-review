import { put, list, get } from "@vercel/blob"
import { NextRequest, NextResponse } from "next/server"
import type { Property } from "@/lib/types"
import { getPropertiesBlobName } from "@/lib/blob-helpers"
import { validateCredentials } from "@/lib/accounts"

function normalizeUrl(url: string | null | undefined): string {
  if (!url) return ""
  return url.split("?")[0].replace(/\/+$/, "")
}

async function getExistingProperties(username: string): Promise<Property[]> {
  const blobName = getPropertiesBlobName(username)
  try {
    const { blobs } = await list({ prefix: blobName })
    if (blobs.length > 0) {
      const result = await get(blobs[0].pathname, { access: "private", useCache: false })
      if (result) {
        const text = await new Response(result.stream).text()
        return JSON.parse(text)
      }
    }
  } catch (error) {
    console.error("[upload-scraper] Error reading existing properties:", error)
  }
  return []
}

function additiveMerge(existing: Property[], incoming: Record<string, unknown>[]): { merged: Property[]; added: number; updated: number } {
  const existingByUrl = new Map<string, Property>()
  for (const p of existing) {
    const key = normalizeUrl(p.url)
    if (key) existingByUrl.set(key, p)
  }

  let added = 0
  let updated = 0
  const seen = new Set<string>()

  for (const raw of incoming) {
    const cleanUrl = normalizeUrl(raw.url as string)
    if (!cleanUrl || seen.has(cleanUrl)) continue
    seen.add(cleanUrl)

    const old = existingByUrl.get(cleanUrl)
    if (old) {
      old.price = (raw.price as number) ?? old.price
      old.priceLabel = (raw.priceLabel as string) ?? old.priceLabel
      old.area = (raw.area as number) ?? old.area
      old.pricePerM2 = (raw.pricePerM2 as number) ?? old.pricePerM2
      old.rooms = (raw.rooms as number) ?? old.rooms
      old.address = (raw.address as string) ?? old.address
      old.image = (raw.image as string) ?? old.image
      if (old.status === "removed") {
        old.status = "pending"
      }
      updated++
    } else {
      const prop: Property = {
        price: (raw.price as number) ?? null,
        priceLabel: (raw.priceLabel as string) ?? null,
        area: (raw.area as number) ?? null,
        pricePerM2: (raw.pricePerM2 as number) ?? null,
        rooms: (raw.rooms as number) ?? null,
        address: (raw.address as string) ?? null,
        url: cleanUrl,
        image: (raw.image as string) ?? null,
        id: cleanUrl,
        status: "pending",
        notes: "",
      }
      existingByUrl.set(cleanUrl, prop)
      added++
    }
  }

  return { merged: Array.from(existingByUrl.values()), added, updated }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  })
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization")
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return NextResponse.json({ error: "Unauthorized" }, {
      status: 401,
      headers: { "Access-Control-Allow-Origin": "*" },
    })
  }

  const decoded = atob(authHeader.slice(6))
  const [username, password] = decoded.split(":")
  const account = validateCredentials(username, password)
  if (!account) {
    return NextResponse.json({ error: "Invalid credentials" }, {
      status: 401,
      headers: { "Access-Control-Allow-Origin": "*" },
    })
  }

  try {
    const incoming = await request.json()
    if (!Array.isArray(incoming)) {
      return NextResponse.json({ error: "JSON must be an array" }, {
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
      })
    }

    const existing = await getExistingProperties(account.username)
    const { merged, added, updated } = additiveMerge(existing, incoming)

    const blobName = getPropertiesBlobName(account.username)
    await put(blobName, JSON.stringify(merged, null, 2), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
    })

    return NextResponse.json({ ok: true, added, updated, total: merged.length }, {
      headers: { "Access-Control-Allow-Origin": "*" },
    })
  } catch (error) {
    console.error("[upload-scraper] Error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: "Upload failed", details: errorMessage }, {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
    })
  }
}
