import { z } from 'zod'

const optionalText = z.string().trim().max(2000).optional().nullable()
const dateOrDateTime = z.string().trim().max(40).optional().nullable()
const assignedMemberId = z.string().uuid().optional().nullable()
const memberId = z.string().uuid().optional().nullable()
const defaultedText = (fallback: string, max: number) =>
  z.string().trim().max(max).optional().nullable().transform((value) => value || fallback)
const defaultedNumber = (fallback: number) =>
  z.union([z.coerce.number().nonnegative(), z.null()]).optional().transform((value) => value ?? fallback)
const defaultedPositiveNumber = (fallback: number) =>
  z.union([z.coerce.number().positive(), z.null()]).optional().transform((value) => value ?? fallback)

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1).max(240),
  description: optionalText,
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  due_date: dateOrDateTime,
  status: z.enum(['pending', 'completed']).default('pending'),
  assigned_to_member_id: assignedMemberId,
})

export const taskUpdateSchema = taskCreateSchema.partial()

export const shoppingCreateSchema = z.object({
  name: z.string().trim().min(1).max(240),
  quantity: defaultedPositiveNumber(1),
  unit: defaultedText('unidad', 50),
  category: defaultedText('general', 100),
  purchased: z.boolean().default(false),
})

export const shoppingUpdateSchema = shoppingCreateSchema.partial()

export const inventoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(240),
  quantity: defaultedNumber(1),
  unit: defaultedText('unidad', 50),
  purchase_date: z.string().trim().max(20).optional().nullable(),
  expiration_date: z.string().trim().max(20).optional().nullable(),
  location: z.enum(['refrigerador', 'congelador', 'despensa', 'otro']).optional().nullable().transform((value) => value || 'despensa'),
  category: defaultedText('general', 100),
  notes: optionalText,
})

export const inventoryUpdateSchema = inventoryCreateSchema.partial()

export const financeCreateSchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: z.coerce.number().positive(),
  category: defaultedText('general', 100),
  description: z.string().trim().max(500).optional().nullable(),
  transaction_date: z.string().trim().max(20).optional(),
})

export const financeUpdateSchema = financeCreateSchema.partial()

const recurringFrequency = z.enum(['daily', 'weekly', 'monthly', 'yearly', 'custom'])
export const recurringExpenseCreateSchema = z.object({
  name: z.string().trim().min(1).max(240),
  category: defaultedText('suscripcion', 100),
  amount: z.coerce.number().nonnegative(),
  currency: z.string().trim().min(1).max(10).transform((value) => value.toUpperCase()).default('CLP'),
  frequency: recurringFrequency.default('monthly'),
  billing_day: z.coerce.number().int().min(1).max(31).optional().nullable(),
  next_billing_date: z.string().date().optional().nullable(),
  start_date: z.string().date().optional().nullable(),
  end_date: z.string().date().optional().nullable(),
  payment_method: z.string().trim().max(120).optional().nullable(),
  notes: optionalText,
  is_active: z.boolean().default(true),
  auto_create_transaction: z.boolean().default(false),
  assigned_to_member_id: assignedMemberId,
})

export const recurringExpenseUpdateSchema = recurringExpenseCreateSchema.partial()

export const memoryCreateSchema = z.object({
  key: z.string().trim().min(1).max(160),
  value: z.string().trim().min(1).max(4000),
  category: defaultedText('general', 100),
  importance: z.coerce.number().int().min(1).max(5).default(3),
  scope: z.enum(['shared', 'personal']).default('shared'),
})

export const memoryUpdateSchema = memoryCreateSchema.partial()

export const profileUpdateSchema = z.object({
  full_name: z.string().trim().max(160).optional().nullable(),
  timezone: z.string().trim().max(100).optional(),
  currency: z.string().trim().min(3).max(3).transform((value) => value.toUpperCase()).optional(),
  preferences: z.record(z.string(), z.unknown()).optional(),
})
