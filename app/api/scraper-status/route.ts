import { list } from "@vercel/blob"
import { NextResponse } from "next/server"
import { getPropertiesBlobName, getAuthenticatedUser } from "@/lib/blob-helpers"

export async function GET() {
  const username = await getAuthenticatedUser()
  if (!username) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const blobName = getPropertiesBlobName(username)
    const { blobs } = await list({ prefix: blobName })
    if (blobs.length > 0) {
      return NextResponse.json({
        hasData: true,
        lastModified: blobs[0].uploadedAt,
        size: blobs[0].size,
      })
    }
  } catch (error) {
    console.error("[scraper-status] Error:", error)
  }

  return NextResponse.json({ hasData: false, lastModified: null, size: 0 })
}
