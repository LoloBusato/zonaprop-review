export interface Account {
  username: string
  password: string
}

export const ACCOUNTS: Account[] = [
  { username: "LoloBusato", password: "ACM1pt++" },
  { username: "DaniloBusato", password: "1234" },
  { username: "Sally", password: "140802"}
]

export function validateCredentials(username: string, password: string): Account | null {
  return ACCOUNTS.find(a => a.username === username && a.password === password) || null
}
