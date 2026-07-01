import { FormEvent, useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, CircleDollarSign, Edit3, Plus, Search, Trash2, TrendingDown, TrendingUp, WalletCards } from 'lucide-react'
import { api, apiData } from '../lib/api'
import type { Finance, Profile } from '../lib/types'
import { formatDate, formatMoney, todayISO } from '../lib/format'
import { useToast } from '../context/ToastContext'
import { Modal } from '../components/Modal'
import { EmptyState } from '../components/EmptyState'
import { Loading } from '../components/Loading'
import { StatCard } from '../components/StatCard'

const currentMonth = () => new Date().toISOString().slice(0, 7)
const emptyForm = { type: 'expense' as Finance['type'], amount: 0, category: 'General', description: '', transaction_date: todayISO() }

type Summary = { month: string; income: number; expense: number; balance: number; current_balance: number; by_category: Record<string, number> }

export function FinancesPage() {
  const [items, setItems] = useState<Finance[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(currentMonth())
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | Finance['type']>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Finance | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const [rows, totals, currentProfile] = await Promise.all([
        apiData<Finance[]>(`/api/finances?limit=200&month=${month}`),
        apiData<Summary>(`/api/finances/summary?month=${month}`),
        apiData<Profile>('/api/profile'),
      ])
      setItems(rows); setSummary(totals); setProfile(currentProfile)
    } catch (caught) { showToast(caught instanceof Error ? caught.message : 'No fue posible cargar las finanzas.', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [month])

  const filtered = useMemo(() => items.filter((item) => {
    const term = search.toLowerCase().trim()
    return (typeFilter === 'all' || item.type === typeFilter) && (!term || item.category.toLowerCase().includes(term) || (item.description || '').toLowerCase().includes(term))
  }), [items, search, typeFilter])

  const currency = profile?.currency || 'CLP'
  const openCreate = (type: Finance['type'] = 'expense') => { setEditing(null); setForm({ ...emptyForm, type }); setModalOpen(true) }
  const openEdit = (item: Finance) => { setEditing(item); setForm({ type: item.type, amount: Number(item.amount), category: item.category, description: item.description || '', transaction_date: item.transaction_date }); setModalOpen(true) }

  const save = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true)
    try {
      const payload = { ...form, description: form.description || null }
      if (editing) {
        const updated = await apiData<Finance>(`/api/finances/${editing.id}`, { method: 'PATCH', body: payload })
        setItems((current) => current.map((item) => item.id === updated.id ? updated : item)); showToast('Movimiento actualizado.')
      } else {
        const created = await apiData<Finance>('/api/finances', { method: 'POST', body: payload })
        setItems((current) => [created, ...current]); showToast('Movimiento registrado.')
      }
      setModalOpen(false); await load()
    } catch (caught) { showToast(caught instanceof Error ? caught.message : 'No fue posible guardar.', 'error') }
    finally { setSaving(false) }
  }

  const remove = async (item: Finance) => {
    if (!window.confirm('¿Eliminar este movimiento?')) return
    await api(`/api/finances/${item.id}`, { method: 'DELETE' })
    showToast('Movimiento eliminado.'); await load()
  }

  return (
    <div className="page-stack">
      <section className="page-heading"><div><span className="eyebrow">Finanzas personales</span><h2>Control de dinero</h2><p>Registra ingresos y gastos para conocer tu saldo mensual.</p></div><div className="button-group"><button className="button ghost" onClick={() => openCreate('income')}><ArrowDownLeft size={18} /> Ingreso</button><button className="button primary" onClick={() => openCreate('expense')}><Plus size={18} /> Gasto</button></div></section>

      <section className="stats-grid three">
        <StatCard icon={<TrendingUp size={22} />} label="Ingresos" value={formatMoney(summary?.income || 0, currency)} />
        <StatCard icon={<TrendingDown size={22} />} label="Gastos" value={formatMoney(summary?.expense || 0, currency)} />
        <StatCard icon={<WalletCards size={22} />} label="Saldo actual" value={formatMoney(summary?.current_balance || 0, currency)} />
      </section>

      <section className="toolbar-card"><div className="search-field"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar movimientos…" /></div><input className="compact-select" type="month" value={month} onChange={(event) => setMonth(event.target.value)} /><select className="compact-select" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}><option value="all">Todos</option><option value="income">Ingresos</option><option value="expense">Gastos</option></select></section>

      {loading ? <Loading /> : filtered.length ? (
        <section className="panel-card no-padding">
          <div className="finance-table">
            {filtered.map((item) => (
              <article className="finance-row" key={item.id}>
                <div className={`finance-icon ${item.type}`}>{item.type === 'income' ? <ArrowDownLeft size={19} /> : <ArrowUpRight size={19} />}</div>
                <div className="finance-description"><strong>{item.description || item.category}</strong><span>{item.category} · {formatDate(item.transaction_date)}</span></div>
                <strong className={item.type === 'income' ? 'positive' : 'negative'}>{item.type === 'income' ? '+' : '-'}{formatMoney(Number(item.amount), currency)}</strong>
                <div className="item-actions"><button className="icon-button" onClick={() => openEdit(item)}><Edit3 size={17} /></button><button className="icon-button danger" onClick={() => void remove(item)}><Trash2 size={17} /></button></div>
              </article>
            ))}
          </div>
        </section>
      ) : <EmptyState icon={<CircleDollarSign size={30} />} title="Sin movimientos" description="Registra un ingreso o gasto para comenzar." />}

      <Modal open={modalOpen} title={editing ? 'Editar movimiento' : form.type === 'income' ? 'Registrar ingreso' : 'Registrar gasto'} onClose={() => setModalOpen(false)}>
        <form className="form-grid" onSubmit={save}>
          <label className="field"><span>Tipo</span><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as Finance['type'] })}><option value="expense">Gasto</option><option value="income">Ingreso</option></select></label>
          <label className="field"><span>Monto</span><input type="number" min="0.01" step="0.01" value={form.amount || ''} onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })} required /></label>
          <label className="field"><span>Categoría</span><input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} required /></label>
          <label className="field"><span>Fecha</span><input type="date" value={form.transaction_date} onChange={(event) => setForm({ ...form, transaction_date: event.target.value })} required /></label>
          <label className="field full-span"><span>Descripción</span><input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Ej.: supermercado, sueldo, transporte…" /></label>
          <div className="form-actions full-span"><button type="button" className="button ghost" onClick={() => setModalOpen(false)}>Cancelar</button><button className="button primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar movimiento'}</button></div>
        </form>
      </Modal>
    </div>
  )
}
