import { NextRequest, NextResponse } from "next/server"
import { validateCredentials } from "@/lib/accounts"

export async function POST(request: NextRequest) {
  const { username, password } = await request.json()

  const account = validateCredentials(username, password)
  if (!account) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true, username: account.username })
  response.cookies.set("zp-user", account.username, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  })

  return response
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete("zp-user")
  return response
}

export async function GET(request: NextRequest) {
  const username = request.cookies.get("zp-user")?.value
  if (!username) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
  return NextResponse.json({ authenticated: true, username })
}
