import { put } from "@vercel/blob"
import { NextRequest, NextResponse } from "next/server"

const BLOB_FILENAME = "propiedades.json"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    console.log("[v0] Upload: file received, name:", file.name, "size:", file.size)

    const text = await file.text()
    console.log("[v0] Upload: text length:", text.length)
    
    const data = JSON.parse(text)
    console.log("[v0] Upload: parsed JSON, items:", Array.isArray(data) ? data.length : "not an array")

    // Add default status and notes if not present
    const processedData = Array.isArray(data) 
      ? data.map((item: Record<string, unknown>) => ({
          ...item,
          status: item.status || "pending",
          notes: item.notes || "",
        }))
      : []

    console.log("[v0] Upload: processed data, items:", processedData.length)

    const result = await put(BLOB_FILENAME, JSON.stringify(processedData, null, 2), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
    })
    
    console.log("[v0] Upload: blob saved, url:", result.url)

    return NextResponse.json({ ok: true, count: processedData.length })
  } catch (error) {
    console.error("[v0] Upload error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: "Upload failed", details: errorMessage }, { status: 500 })
  }
}
