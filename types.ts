export type Role = 'treasurer' | 'member'

export interface Member {
  id: number
  name: string
  paid: boolean
}

export interface MonthPayment {
  id: number
  member_id: number
  month_key: string
  paid: boolean
}

export interface ChatMessage {
  id: number
  sender: string
  role: Role
  message: string | null
  image_b64: string | null
  created_at: string
}

export interface LedgerEntry {
  id: number
  month_key: string
  beneficiary: string
  notes: string | null
}

export type Tab = 'home' | 'members' | 'schedule' | 'chat' | 'ledger'
