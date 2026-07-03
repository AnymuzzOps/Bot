import type { ToolExecutionContext } from '../types'
import { localDateISO, monthBounds, daysFromNowISO } from '../lib/dates'
import { HttpError, assertNoDbError } from '../lib/errors'
import { escapeSearch } from '../lib/query'

export const assistantTools = [
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Crea una tarea personal nueva.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] },
          due_date: { type: ['string', 'null'], description: 'Fecha ISO 8601 o null.' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_task',
      description: 'Busca una tarea por texto y la modifica o marca como completada.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] },
          due_date: { type: ['string', 'null'] },
          status: { type: 'string', enum: ['pending', 'completed'] },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_tasks',
      description: 'Consulta tareas por estado o texto.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'completed'] },
          query: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_shopping_item',
      description: 'Agrega un producto a la lista de compras.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          quantity: { type: 'number' },
          unit: { type: 'string' },
          category: { type: 'string' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_shopping_item',
      description: 'Busca un producto de compras y lo marca comprado o actualiza.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          purchased: { type: 'boolean' },
          quantity: { type: 'number' },
          unit: { type: 'string' },
          category: { type: 'string' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_shopping',
      description: 'Consulta la lista de compras.',
      parameters: {
        type: 'object',
        properties: {
          purchased: { type: 'boolean' },
          query: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_inventory_item',
      description: 'Agrega un alimento al inventario.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          quantity: { type: 'number' },
          unit: { type: 'string' },
          purchase_date: { type: ['string', 'null'] },
          expiration_date: { type: ['string', 'null'] },
          location: { type: 'string', enum: ['refrigerador', 'congelador', 'despensa', 'otro'] },
          category: { type: 'string' },
        },
        required: ['name', 'quantity', 'unit'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'adjust_inventory',
      description: 'Busca un alimento y ajusta su cantidad. delta negativo descuenta.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          delta: { type: 'number' },
        },
        required: ['query', 'delta'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_inventory',
      description: 'Consulta inventario, opcionalmente próximos a vencer.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          expiring_within_days: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'record_finance',
      description: 'Registra un ingreso o gasto.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['income', 'expense'] },
          amount: { type: 'number' },
          category: { type: 'string' },
          description: { type: 'string' },
          transaction_date: { type: 'string', description: 'Fecha YYYY-MM-DD.' },
        },
        required: ['type', 'amount', 'category'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_finance_summary',
      description: 'Obtiene ingresos, gastos y saldo de un mes.',
      parameters: {
        type: 'object',
        properties: {
          month: { type: 'string', description: 'Mes YYYY-MM.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_memory',
      description: 'Guarda o actualiza un dato personal estable y útil para futuras conversaciones.',
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          value: { type: 'string' },
          category: { type: 'string' },
          importance: { type: 'integer', minimum: 1, maximum: 5 },
          scope: { type: 'string', enum: ['shared', 'personal'] },
        },
        required: ['key', 'value'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'global_search',
      description: 'Busca texto en tareas, compras, inventario, finanzas y memoria.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
    },
  },
] as const

const findFirst = async (
  ctx: ToolExecutionContext,
  table: string,
  columns: string[],
  query: string,
) => {
  const safe = escapeSearch(query)
  if (!safe) throw new HttpError(400, 'Debes indicar qué elemento buscas.')
  const filters = columns.map((column) => `${column}.ilike.%${safe}%`).join(',')
  const result = await ctx.supabase
    .from(table)
    .select('*')
    .eq('household_id', ctx.householdId)
    .or(filters)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  assertNoDbError(result.error)
  if (!result.data) throw new HttpError(404, `No encontré coincidencias para “${query}”.`)
  return result.data as Record<string, unknown>
}

export const executeAssistantTool = async (
  name: string,
  args: Record<string, unknown>,
  ctx: ToolExecutionContext,
) => {
  switch (name) {
    case 'create_task': {
      const payload = {
        household_id: ctx.householdId,
        user_id: ctx.userId,
        title: String(args.title || '').trim(),
        description: args.description ? String(args.description) : null,
        priority: ['low', 'medium', 'high'].includes(String(args.priority)) ? args.priority : 'medium',
        due_date: args.due_date || null,
        status: 'pending',
        created_by_member_id: ctx.memberId,
      }
      if (!payload.title) throw new HttpError(400, 'La tarea necesita un título.')
      const { data, error } = await ctx.supabase.from('tasks').insert(payload).select().single()
      assertNoDbError(error)
      return data
    }
    case 'update_task': {
      const row = await findFirst(ctx, 'tasks', ['title', 'description'], String(args.query || ''))
      const update: Record<string, unknown> = {}
      for (const key of ['title', 'description', 'priority', 'due_date', 'status']) {
        if (args[key] !== undefined) update[key] = args[key]
      }
      if (args.status === 'completed') update.completed_at = new Date().toISOString()
      if (args.status === 'pending') update.completed_at = null
      if (!Object.keys(update).length) throw new HttpError(400, 'No hay cambios para aplicar.')
      const { data, error } = await ctx.supabase
        .from('tasks')
        .update(update)
        .eq('id', row.id)
        .eq('household_id', ctx.householdId)
        .select()
        .single()
      assertNoDbError(error)
      return data
    }
    case 'list_tasks': {
      let query = ctx.supabase.from('tasks').select('*').eq('household_id', ctx.householdId).order('created_at', { ascending: false }).limit(30)
      if (args.status) query = query.eq('status', args.status)
      if (args.query) {
        const safe = escapeSearch(String(args.query))
        query = query.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`)
      }
      const { data, error } = await query
      assertNoDbError(error)
      return data
    }
    case 'add_shopping_item': {
      const payload = {
        household_id: ctx.householdId,
        user_id: ctx.userId,
        name: String(args.name || '').trim(),
        quantity: Number(args.quantity || 1),
        unit: String(args.unit || 'unidad'),
        category: String(args.category || 'General'),
        created_by_member_id: ctx.memberId,
      }
      if (!payload.name) throw new HttpError(400, 'El producto necesita un nombre.')
      const { data, error } = await ctx.supabase.from('shopping_items').insert(payload).select().single()
      assertNoDbError(error)
      return data
    }
    case 'update_shopping_item': {
      const row = await findFirst(ctx, 'shopping_items', ['name', 'category'], String(args.query || ''))
      const update: Record<string, unknown> = {}
      for (const key of ['quantity', 'unit', 'category', 'purchased']) {
        if (args[key] !== undefined) update[key] = args[key]
      }
      if (args.purchased === true) update.purchased_at = new Date().toISOString()
      if (args.purchased === false) update.purchased_at = null
      const { data, error } = await ctx.supabase.from('shopping_items').update(update).eq('id', row.id).eq('household_id', ctx.householdId).select().single()
      assertNoDbError(error)
      return data
    }
    case 'list_shopping': {
      let query = ctx.supabase.from('shopping_items').select('*').eq('household_id', ctx.householdId).order('purchased', { ascending: true }).limit(40)
      if (typeof args.purchased === 'boolean') query = query.eq('purchased', args.purchased)
      if (args.query) query = query.ilike('name', `%${escapeSearch(String(args.query))}%`)
      const { data, error } = await query
      assertNoDbError(error)
      return data
    }
    case 'add_inventory_item': {
      const payload = {
        household_id: ctx.householdId,
        user_id: ctx.userId,
        name: String(args.name || '').trim(),
        quantity: Number(args.quantity),
        unit: String(args.unit || '').trim(),
        purchase_date: args.purchase_date || null,
        expiration_date: args.expiration_date || null,
        location: args.location || 'despensa',
        category: args.category || 'General',
        created_by_member_id: ctx.memberId,
      }
      if (!payload.name || !payload.unit || !Number.isFinite(payload.quantity)) throw new HttpError(400, 'Faltan datos del alimento.')
      const { data, error } = await ctx.supabase.from('inventory').insert(payload).select().single()
      assertNoDbError(error)
      return data
    }
    case 'adjust_inventory': {
      const row = await findFirst(ctx, 'inventory', ['name', 'category'], String(args.query || ''))
      const current = Number(row.quantity || 0)
      const delta = Number(args.delta)
      if (!Number.isFinite(delta)) throw new HttpError(400, 'El ajuste debe ser numérico.')
      const quantity = Math.max(0, current + delta)
      const { data, error } = await ctx.supabase.from('inventory').update({ quantity }).eq('id', row.id).eq('household_id', ctx.householdId).select().single()
      assertNoDbError(error)
      return data
    }
    case 'list_inventory': {
      let query = ctx.supabase.from('inventory').select('*').eq('household_id', ctx.householdId).order('expiration_date', { ascending: true, nullsFirst: false }).limit(40)
      if (args.query) query = query.ilike('name', `%${escapeSearch(String(args.query))}%`)
      if (Number.isFinite(Number(args.expiring_within_days))) {
        query = query.not('expiration_date', 'is', null).lte('expiration_date', daysFromNowISO(Number(args.expiring_within_days)))
      }
      const { data, error } = await query
      assertNoDbError(error)
      return data
    }
    case 'record_finance': {
      const type = String(args.type)
      const amount = Number(args.amount)
      if (!['income', 'expense'].includes(type) || !Number.isFinite(amount) || amount <= 0) throw new HttpError(400, 'El movimiento financiero no es válido.')
      const payload = {
        household_id: ctx.householdId,
        user_id: ctx.userId,
        type,
        amount,
        category: String(args.category || 'General'),
        description: args.description ? String(args.description) : null,
        transaction_date: args.transaction_date || localDateISO(ctx.timezone),
        created_by_member_id: ctx.memberId,
      }
      const { data, error } = await ctx.supabase.from('finances').insert(payload).select().single()
      assertNoDbError(error)
      return data
    }
    case 'get_finance_summary': {
      const { month, start, end } = monthBounds(args.month ? String(args.month) : undefined)
      const [monthlyResult, allTimeResult] = await Promise.all([
        ctx.supabase.from('finances').select('type,amount,category').eq('household_id', ctx.householdId).gte('transaction_date', start).lt('transaction_date', end),
        ctx.supabase.from('finances').select('type,amount').eq('household_id', ctx.householdId),
      ])
      assertNoDbError(monthlyResult.error)
      assertNoDbError(allTimeResult.error)
      const summary = (monthlyResult.data || []).reduce((acc, row) => {
        const amount = Number(row.amount)
        if (row.type === 'income') acc.income += amount
        else acc.expense += amount
        return acc
      }, { income: 0, expense: 0 })
      const currentBalance = (allTimeResult.data || []).reduce(
        (total, row) => total + (row.type === 'income' ? Number(row.amount) : -Number(row.amount)),
        0,
      )
      return { month, ...summary, balance: summary.income - summary.expense, current_balance: currentBalance, currency: ctx.currency }
    }
    case 'save_memory': {
      const payload = {
        household_id: ctx.householdId,
        user_id: ctx.userId,
        key: String(args.key || '').trim(),
        value: String(args.value || '').trim(),
        category: String(args.category || 'general'),
        importance: Math.min(5, Math.max(1, Number(args.importance || 3))),
        scope: String(args.scope || 'shared') === 'personal' ? 'personal' : 'shared',
        created_by_member_id: ctx.memberId,
      }
      if (!payload.key || !payload.value) throw new HttpError(400, 'La memoria necesita clave y valor.')
      const scopedPayload = {
        ...payload,
        member_id: payload.scope === 'personal' ? ctx.memberId : null,
      }
      const { data, error } = await ctx.supabase.from('memories').insert(scopedPayload).select().single()
      assertNoDbError(error)
      return data
    }
    case 'global_search': {
      const safe = escapeSearch(String(args.query || ''))
      if (!safe) return []
      const [tasks, shopping, inventory, finances, memories] = await Promise.all([
        ctx.supabase.from('tasks').select('id,title,description,status,created_at').eq('household_id', ctx.householdId).or(`title.ilike.%${safe}%,description.ilike.%${safe}%`).limit(8),
        ctx.supabase.from('shopping_items').select('id,name,category,purchased,created_at').eq('household_id', ctx.householdId).or(`name.ilike.%${safe}%,category.ilike.%${safe}%`).limit(8),
        ctx.supabase.from('inventory').select('id,name,category,location,created_at').eq('household_id', ctx.householdId).or(`name.ilike.%${safe}%,category.ilike.%${safe}%`).limit(8),
        ctx.supabase.from('finances').select('id,description,category,type,amount,created_at').eq('household_id', ctx.householdId).or(`description.ilike.%${safe}%,category.ilike.%${safe}%`).limit(8),
        ctx.supabase.from('memories').select('id,key,value,category,created_at').eq('household_id', ctx.householdId).or(`scope.eq.shared,and(scope.eq.personal,member_id.eq.${ctx.memberId})`).or(`key.ilike.%${safe}%,value.ilike.%${safe}%`).limit(8),
      ])
      return {
        tasks: tasks.data || [],
        shopping: shopping.data || [],
        inventory: inventory.data || [],
        finances: finances.data || [],
        memories: memories.data || [],
      }
    }
    default:
      throw new HttpError(400, `Herramienta desconocida: ${name}`)
  }
}
