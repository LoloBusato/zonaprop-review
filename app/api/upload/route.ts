import { copy, put, list, get } from "@vercel/blob"
import { NextRequest, NextResponse } from "next/server"
import type { Property } from "@/lib/types"
import { getPropertiesBlobName, getBlobPrefix, getAuthenticatedUser } from "@/lib/blob-helpers"

function normalizeUrl(url: string | null | undefined): string {
  if (!url) return ""
  return url.split("?")[0].replace(/\/+$/, "")
}

async function getExistingBlob(username: string): Promise<{ data: Property[]; url: string | null }> {
  const blobName = getPropertiesBlobName(username)
  try {
    const { blobs } = await list({ prefix: blobName })
    if (blobs.length > 0) {
      const blob = blobs[0]
      const result = await get(blob.pathname, { access: "private", useCache: false })
      if (result) {
        const text = await new Response(result.stream).text()
        return { data: JSON.parse(text), url: blob.url }
      }
    }
  } catch (error) {
    console.error("[upload] Error reading existing properties:", error)
  }
  return { data: [], url: null }
}

async function backupBlob(blobUrl: string, username: string): Promise<string> {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")
  const backupPathname = `${getBlobPrefix(username)}backups/propiedades-${timestamp}.json`
  const result = await copy(blobUrl, backupPathname, { access: "private" })
  return result.pathname
}

function mergeProperties(
  existing: Property[],
  incoming: Record<string, unknown>[]
): Property[] {
  const oldByUrl: Record<string, Property> = {}
  for (const p of existing) {
    const key = normalizeUrl(p.url)
    if (key) oldByUrl[key] = p
  }

  const merged: Property[] = []
  const seen = new Set<string>()

  for (const raw of incoming) {
    const cleanUrl = normalizeUrl(raw.url as string)
    if (!cleanUrl || seen.has(cleanUrl)) continue
    seen.add(cleanUrl)

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

    const old = oldByUrl[cleanUrl]
    if (old) {
      prop.status = old.status === "removed" ? "pending" : old.status
      prop.notes = old.notes || ""
    }

    merged.push(prop)
  }

  for (const old of existing) {
    const key = normalizeUrl(old.url)
    if (key && !seen.has(key)) {
      seen.add(key)
      merged.push({ ...old, id: key, url: key, status: "removed" })
    }
  }

  return merged
}

export async function POST(request: NextRequest) {
  const username = await getAuthenticatedUser()
  if (!username) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const text = await file.text()
    const incoming = JSON.parse(text)

    if (!Array.isArray(incoming)) {
      return NextResponse.json({ error: "JSON must be an array" }, { status: 400 })
    }

    const { data: existing, url: existingUrl } = await getExistingBlob(username)

    if (existingUrl && existing.length > 0) {
      const backupPath = await backupBlob(existingUrl, username)
      console.log(`[upload] Backed up existing data to ${backupPath}`)
    }

    const merged = mergeProperties(existing, incoming)

    const blobName = getPropertiesBlobName(username)
    await put(blobName, JSON.stringify(merged, null, 2), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
    })

    const kept = merged.filter((p) => p.status !== "pending" && p.status !== "removed").length
    const newCount = merged.filter((p) => p.status === "pending").length
    const removed = merged.filter((p) => p.status === "removed").length

    return NextResponse.json({
      ok: true,
      count: merged.length,
      kept,
      new: newCount,
      removed,
    })
  } catch (error) {
    console.error("[upload] Error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: "Upload failed", details: errorMessage }, { status: 500 })
  }
}
