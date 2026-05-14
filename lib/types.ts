export interface Property {
  price: number | null
  priceLabel: string | null
  area: number | null
  pricePerM2: number | null
  rooms: number | null
  address: string | null
  url: string | null
  image: string | null
  id: string
  status: "pending" | "favorite" | "rejected"
  notes: string
}
