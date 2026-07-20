export interface SearchFilters {
  barrios: string[]
  aptoCredito: boolean
  minPrice: number | null
  maxPrice: number | null
  minArea: number | null
  maxArea: number | null
}

export const DEFAULT_FILTERS: SearchFilters = {
  barrios: [
    "nunez", "belgrano", "colegiales", "palermo", "villa-crespo",
    "chacarita", "villa-ortuzar", "parque-chas", "coghlan",
    "villa-urquiza", "saavedra", "villa-pueyrredon",
    "villa-general-mitre", "villa-del-parque", "villa-santa-rita",
    "villa-devoto", "la-paternal", "recoleta", "agronomia",
  ],
  aptoCredito: true,
  minPrice: null,
  maxPrice: 100000,
  minArea: 40,
  maxArea: null,
}

export interface BarrioOption {
  slug: string
  label: string
}

export const BARRIOS: BarrioOption[] = [
  { slug: "agronomia", label: "Agronomía" },
  { slug: "almagro", label: "Almagro" },
  { slug: "balvanera", label: "Balvanera" },
  { slug: "barracas", label: "Barracas" },
  { slug: "belgrano", label: "Belgrano" },
  { slug: "boedo", label: "Boedo" },
  { slug: "caballito", label: "Caballito" },
  { slug: "chacarita", label: "Chacarita" },
  { slug: "coghlan", label: "Coghlan" },
  { slug: "colegiales", label: "Colegiales" },
  { slug: "constitucion", label: "Constitución" },
  { slug: "flores", label: "Flores" },
  { slug: "floresta", label: "Floresta" },
  { slug: "la-boca", label: "La Boca" },
  { slug: "la-paternal", label: "La Paternal" },
  { slug: "liniers", label: "Liniers" },
  { slug: "mataderos", label: "Mataderos" },
  { slug: "monte-castro", label: "Monte Castro" },
  { slug: "monserrat", label: "Monserrat" },
  { slug: "nueva-pompeya", label: "Nueva Pompeya" },
  { slug: "nunez", label: "Núñez" },
  { slug: "palermo", label: "Palermo" },
  { slug: "parque-avellaneda", label: "Parque Avellaneda" },
  { slug: "parque-chas", label: "Parque Chas" },
  { slug: "parque-patricios", label: "Parque Patricios" },
  { slug: "puerto-madero", label: "Puerto Madero" },
  { slug: "recoleta", label: "Recoleta" },
  { slug: "retiro", label: "Retiro" },
  { slug: "saavedra", label: "Saavedra" },
  { slug: "san-cristobal", label: "San Cristóbal" },
  { slug: "san-nicolas", label: "San Nicolás" },
  { slug: "san-telmo", label: "San Telmo" },
  { slug: "velez-sarsfield", label: "Vélez Sársfield" },
  { slug: "versalles", label: "Versalles" },
  { slug: "villa-crespo", label: "Villa Crespo" },
  { slug: "villa-del-parque", label: "Villa del Parque" },
  { slug: "villa-devoto", label: "Villa Devoto" },
  { slug: "villa-general-mitre", label: "Villa General Mitre" },
  { slug: "villa-lugano", label: "Villa Lugano" },
  { slug: "villa-luro", label: "Villa Luro" },
  { slug: "villa-ortuzar", label: "Villa Ortúzar" },
  { slug: "villa-pueyrredon", label: "Villa Pueyrredón" },
  { slug: "villa-real", label: "Villa Real" },
  { slug: "villa-riachuelo", label: "Villa Riachuelo" },
  { slug: "villa-santa-rita", label: "Villa Santa Rita" },
  { slug: "villa-soldati", label: "Villa Soldati" },
  { slug: "villa-urquiza", label: "Villa Urquiza" },
]

export function buildSearchUrl(filters: SearchFilters): string {
  const parts: string[] = ["inmuebles-venta"]

  if (filters.barrios.length > 0) {
    parts.push(filters.barrios.join("-"))
  }

  if (filters.aptoCredito) {
    parts.push("con-apto-credito")
  }

  if (filters.minArea) {
    parts.push(`mas-${filters.minArea}-m2-cubiertos`)
  }
  if (filters.maxArea) {
    parts.push(`menos-${filters.maxArea}-m2-cubiertos`)
  }

  if (filters.minPrice) {
    parts.push(`mas-${filters.minPrice}-dolar`)
  }
  if (filters.maxPrice) {
    parts.push(`menos-${filters.maxPrice}-dolar`)
  }

  return `https://www.zonaprop.com.ar/${parts.join("-")}.html`
}
