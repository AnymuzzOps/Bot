import { z } from 'zod'

const optionalText = z.string().trim().max(2000).optional().nullable()
const dateOrDateTime = z.string().trim().max(40).optional().nullable()
const assignedMemberId = z.string().uuid().optional().nullable()
const memberId = z.string().uuid().optional().nullable()

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
  quantity: z.coerce.number().positive().default(1),
  unit: z.string().trim().max(50).default('unidad'),
  category: z.string().trim().max(100).default('General'),
  purchased: z.boolean().default(false),
})

export const shoppingUpdateSchema = shoppingCreateSchema.partial()

export const inventoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(240),
  quantity: z.coerce.number().nonnegative(),
  unit: z.string().trim().min(1).max(50),
  purchase_date: z.string().trim().max(20).optional().nullable(),
  expiration_date: z.string().trim().max(20).optional().nullable(),
  location: z.enum(['refrigerador', 'congelador', 'despensa', 'otro']).default('despensa'),
  category: z.string().trim().max(100).default('General'),
  notes: optionalText,
})

export const inventoryUpdateSchema = inventoryCreateSchema.partial()

export const financeCreateSchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: z.coerce.number().positive(),
  category: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional().nullable(),
  transaction_date: z.string().trim().max(20).optional(),
})

export const financeUpdateSchema = financeCreateSchema.partial()

export const memoryCreateSchema = z.object({
  key: z.string().trim().min(1).max(160),
  value: z.string().trim().min(1).max(4000),
  category: z.string().trim().max(100).default('general'),
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
