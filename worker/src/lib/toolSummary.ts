export type ExecutedTool = {
  name: string
  args: Record<string, unknown>
  result: unknown
  ok: boolean
  duplicate?: boolean
}

const toolAction = (name: string) => ({
  add_inventory_item: 'Agregué al inventario',
  add_shopping_item: 'Agregué a compras',
  create_task: 'Creé las tareas',
  record_finance: 'Registré los movimientos',
  create_recurring_expense: 'Creé las suscripciones',
  save_memory: 'Guardé en memoria',
}[name] || `Ejecuté ${name}`)

const toolItemName = (tool: ExecutedTool) => {
  for (const key of ['name', 'title', 'description', 'key', 'query']) {
    const value = tool.args[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return tool.name
}

export const buildToolExecutionSummary = (executed: ExecutedTool[]) => {
  if (!executed.length) return 'No realicé cambios.'
  const successful = executed.filter((tool) => tool.ok && !tool.duplicate)
  const duplicates = executed.filter((tool) => tool.ok && tool.duplicate)
  const failed = executed.filter((tool) => !tool.ok)
  const groups = new Map<string, string[]>()
  for (const tool of successful) groups.set(tool.name, [...(groups.get(tool.name) || []), toolItemName(tool)])

  const parts = [...groups].map(([name, items]) => `${toolAction(name)}: ${items.join(', ')}`)
  if (duplicates.length) parts.push(`Omití ${duplicates.length} acción${duplicates.length === 1 ? '' : 'es'} repetida${duplicates.length === 1 ? '' : 's'} para evitar duplicados: ${duplicates.map(toolItemName).join(', ')}`)
  if (failed.length) parts.push(`No pude completar ${failed.length}: ${failed.map((tool) => `${toolItemName(tool)} (${(tool.result as { error?: string })?.error || 'error desconocido'})`).join(', ')}`)
  const completed = successful.length + duplicates.length
  return `Listo. ${parts.join('. ')}. Completé ${completed} de ${executed.length} acciones${failed.length ? `; quedaron ${failed.length} pendientes` : ''}.`
}
