export type View = 'dashboard' | 'chat' | 'tasks' | 'shopping' | 'inventory' | 'finances' | 'memory' | 'calendar' | 'settings'

export type Household = {
  id: string
  name: string
}

export type HouseholdMember = {
  id: string
  household_id?: string
  auth_user_id?: string
  name: string
  slug: string
  role?: 'owner' | 'member'
  avatar: string | null
  created_at?: string
}

export type HouseholdMe = {
  household: Household
  member: Pick<HouseholdMember, 'id' | 'name' | 'slug' | 'role' | 'avatar'>
}

export type Profile = {
  id: string
  email: string
  full_name: string | null
  timezone: string
  currency: string
  preferences: Record<string, unknown>
}

export type Task = {
  id: string
  title: string
  description: string | null
  status: 'pending' | 'completed'
  priority: 'low' | 'medium' | 'high'
  due_date: string | null
  completed_at: string | null
  created_at: string
  created_by_member_id: string | null
  created_by_member?: HouseholdMember | null
}

export type ShoppingItem = {
  id: string
  name: string
  quantity: number
  unit: string
  category: string
  purchased: boolean
  created_at: string
  created_by_member_id: string | null
  created_by_member?: HouseholdMember | null
}

export type InventoryItem = {
  id: string
  name: string
  quantity: number
  unit: string
  purchase_date: string | null
  expiration_date: string | null
  location: 'refrigerador' | 'congelador' | 'despensa' | 'otro'
  category: string
  notes: string | null
  created_at: string
  created_by_member_id: string | null
  created_by_member?: HouseholdMember | null
}

export type Finance = {
  id: string
  type: 'income' | 'expense'
  amount: number
  category: string
  description: string | null
  transaction_date: string
  created_at: string
  created_by_member_id: string | null
  created_by_member?: HouseholdMember | null
}

export type Memory = {
  id: string
  key: string
  value: string
  category: string
  importance: number
  created_at: string
  updated_at: string
  scope: 'shared' | 'personal'
  member_id: string | null
  created_by_member_id: string | null
  created_by_member?: HouseholdMember | null
}


export type WorkShift = {
  id: string
  household_id: string
  created_by_member_id: string | null
  assigned_to_member_id: string | null
  shift_date: string
  shift_type: 'morning' | 'afternoon' | 'closing' | 'day_off' | 'custom'
  label: string
  start_time: string | null
  end_time: string | null
  color: string | null
  notes: string | null
  is_day_off: boolean
  created_at: string
  updated_at: string
}

export type Conversation = {
  id: string
  role: 'user' | 'assistant'
  content: string
  metadata?: Record<string, unknown>
  created_at: string
  created_by_member_id: string | null
  created_by_member?: HouseholdMember | null
}

export type DashboardData = {
  profile: Profile | null
  pending_tasks: Task[]
  pending_shopping: ShoppingItem[]
  expiring_inventory: InventoryItem[]
  finances: { month: string; income: number; expense: number; balance: number; current_balance: number }
  recent_activity: Conversation[]
}

export type SearchResult = {
  type: 'task' | 'shopping' | 'inventory' | 'finance' | 'memory'
  title: string
  subtitle: string
  item: Record<string, unknown>
}
