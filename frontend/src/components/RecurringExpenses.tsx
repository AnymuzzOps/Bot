import { FormEvent, useEffect, useMemo, useState } from 'react'
import { CalendarClock, Edit3, Plus, Trash2 } from 'lucide-react'
import { api, apiData } from '../lib/api'
import type { RecurringExpense } from '../lib/types'
import { formatDate, formatMoney } from '../lib/format'
import { Modal } from './Modal'
import { useToast } from '../context/ToastContext'

const categories = ['Streaming', 'Software', 'Nube', 'Telefonía', 'Internet', 'Vivienda', 'Transporte', 'Finanzas', 'Salud', 'Educación', 'Otros']
const blank = { name: '', amount: 0, category: 'Streaming', frequency: 'monthly' as RecurringExpense['frequency'], billing_day: null as number | null, next_billing_date: '', payment_method: '', notes: '', is_active: true, auto_create_transaction: false }
const frequencyLabel = { daily: 'Diaria', weekly: 'Semanal', monthly: 'Mensual', yearly: 'Anual', custom: 'Personalizada' }

export function RecurringExpenses({ month, currency, onChanged }: { month: string; currency: string; onChanged: () => void }) {
  const [items, setItems] = useState<RecurringExpense[]>([]); const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<RecurringExpense | null>(null); const [form, setForm] = useState(blank); const [saving, setSaving] = useState(false)
  const { showToast } = useToast()
  const load = async () => setItems(await apiData<RecurringExpense[]>(`/api/recurring-expenses?month=${month}`))
  useEffect(() => { void load().catch((e) => showToast(e instanceof Error ? e.message : 'No se pudieron cargar los gastos fijos.', 'error')) }, [month])
  const total = useMemo(() => items.filter((x) => x.is_active).reduce((sum, x) => sum + Number(x.monthly_equivalent || 0), 0), [items])
  const upcoming = items.filter((x) => x.is_active && x.next_billing_date).slice(0, 3)
  const create = () => { setEditing(null); setForm(blank); setOpen(true) }
  const edit = (x: RecurringExpense) => { setEditing(x); setForm({ name: x.name, amount: Number(x.amount), category: x.category, frequency: x.frequency, billing_day: x.billing_day, next_billing_date: x.next_billing_date || '', payment_method: x.payment_method || '', notes: x.notes || '', is_active: x.is_active, auto_create_transaction: false }); setOpen(true) }
  const save = async (event: FormEvent) => { event.preventDefault(); setSaving(true); try {
    const body = { ...form, next_billing_date: form.next_billing_date || null, payment_method: form.payment_method || null, notes: form.notes || null }
    await apiData(editing ? `/api/recurring-expenses/${editing.id}` : '/api/recurring-expenses', { method: editing ? 'PATCH' : 'POST', body }); setOpen(false); await load(); onChanged(); showToast(editing ? 'Suscripción actualizada.' : 'Suscripción agregada.')
  } catch (e) { showToast(e instanceof Error ? e.message : 'No fue posible guardar.', 'error') } finally { setSaving(false) } }
  const remove = async (x: RecurringExpense) => { if (!confirm(`¿Eliminar ${x.name}?`)) return; await api(`/api/recurring-expenses/${x.id}`, { method: 'DELETE' }); await load(); onChanged(); showToast('Suscripción eliminada.') }
  return <section className="page-stack recurring-section">
    <div className="panel-header"><div><span>Proyección</span><h3>Suscripciones y gastos fijos</h3><p className="muted">Compromisos recurrentes; no son transacciones ya pagadas.</p></div><button className="button primary" onClick={create}><Plus size={18}/> Agregar suscripción</button></div>
    <div className="recurring-summary"><div><span>Total mensual estimado</span><strong>{formatMoney(total, currency)}</strong><small>Incluye equivalentes mensuales</small></div><div><span>Activas</span><strong>{items.filter(x => x.is_active).length}</strong><small>suscripciones y compromisos</small></div><div><span>Próximos cobros</span>{upcoming.length ? upcoming.map(x => <small key={x.id}>{x.name} · {formatDate(x.next_billing_date)}</small>) : <small>Sin fechas próximas</small>}</div></div>
    <div className="recurring-grid">{items.map(x => <article className={`recurring-card ${!x.is_active ? 'inactive' : ''}`} key={x.id}><div className="recurring-card-head"><div className="finance-icon expense"><CalendarClock size={18}/></div><div><strong>{x.name}</strong><span>{x.category} · {frequencyLabel[x.frequency]}</span></div><strong>{formatMoney(Number(x.amount), x.currency)}</strong></div><div className="recurring-details"><span>Cobro: {x.billing_day ? `día ${x.billing_day}` : 'sin día'}</span><span>Próximo: {x.next_billing_date ? formatDate(x.next_billing_date) : 'sin fecha'}</span><span>{x.payment_method || 'Método no indicado'}</span><span className={x.is_active ? 'positive' : 'muted'}>{x.is_active ? 'Activa' : 'Inactiva'}</span></div><div className="item-actions"><button className="icon-button" onClick={() => edit(x)} aria-label="Editar"><Edit3 size={17}/></button><button className="icon-button danger" onClick={() => void remove(x)} aria-label="Eliminar"><Trash2 size={17}/></button></div></article>)}</div>
    <Modal open={open} title={editing ? 'Editar suscripción' : 'Agregar suscripción'} onClose={() => setOpen(false)}><form className="form-grid" onSubmit={save}>
      <label className="field"><span>Nombre</span><input required value={form.name} onChange={e => setForm({...form, name:e.target.value})}/></label><label className="field"><span>Monto</span><input required type="number" min="0" step="0.01" value={form.amount || ''} onChange={e => setForm({...form, amount:Number(e.target.value)})}/></label>
      <label className="field"><span>Categoría</span><select value={form.category} onChange={e => setForm({...form, category:e.target.value})}>{categories.map(x => <option key={x}>{x}</option>)}</select></label><label className="field"><span>Frecuencia</span><select value={form.frequency} onChange={e => setForm({...form, frequency:e.target.value as RecurringExpense['frequency']})}>{Object.entries(frequencyLabel).map(([v,l]) => <option value={v} key={v}>{l}</option>)}</select></label>
      <label className="field"><span>Día de cobro</span><input type="number" min="1" max="31" value={form.billing_day || ''} onChange={e => setForm({...form, billing_day:e.target.value ? Number(e.target.value) : null})}/></label><label className="field"><span>Próxima fecha</span><input type="date" value={form.next_billing_date} onChange={e => setForm({...form, next_billing_date:e.target.value})}/></label>
      <label className="field"><span>Método de pago</span><input value={form.payment_method} onChange={e => setForm({...form, payment_method:e.target.value})}/></label><label className="field"><span>Nota</span><input value={form.notes} onChange={e => setForm({...form, notes:e.target.value})}/></label>
      <label className="check-row"><input type="checkbox" checked={form.is_active} onChange={e => setForm({...form,is_active:e.target.checked})}/><span>Considerar en proyección mensual</span></label><label className="check-row disabled"><input type="checkbox" disabled/><span>Crear gasto automáticamente (próximamente)</span></label>
      <div className="form-actions full-span"><button type="button" className="button ghost" onClick={() => setOpen(false)}>Cancelar</button><button className="button primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button></div>
    </form></Modal>
  </section>
}
