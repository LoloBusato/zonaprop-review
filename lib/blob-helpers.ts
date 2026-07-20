import { cookies } from "next/headers"

export function getBlobPrefix(username: string): string {
  return `accounts/${username}/`
}

export function getPropertiesBlobName(username: string): string {
  return `${getBlobPrefix(username)}propiedades.json`
}

export function getFiltersBlobName(username: string): string {
  return `${getBlobPrefix(username)}filters.json`
}

export async function getAuthenticatedUser(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get("zp-user")?.value || null
}
