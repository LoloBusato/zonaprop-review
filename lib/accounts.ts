export interface Account {
  username: string
  password: string
}

export const ACCOUNTS: Account[] = [
  { username: "LoloBusato", password: "ACM1pt++" },
]

export function validateCredentials(username: string, password: string): Account | null {
  return ACCOUNTS.find(a => a.username === username && a.password === password) || null
}
