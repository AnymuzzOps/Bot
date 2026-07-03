import { FormEvent, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Edit3, PackageOpen, Plus, Search, Trash2 } from 'lucide-react'
import { api, apiData } from '../lib/api'
import type { InventoryItem } from '../lib/types'
import { formatDate, todayISO } from '../lib/format'
import { useToast } from '../context/ToastContext'
import { useActiveMember } from '../context/ActiveMemberContext'
import { Modal } from '../components/Modal'
import { EmptyState } from '../components/EmptyState'
import { Loading } from '../components/Loading'

const emptyForm = {
  name: '', quantity: 1, unit: 'unidad', purchase_date: todayISO(), expiration_date: '',
  location: 'despensa' as InventoryItem['location'], category: 'General', notes: '',
}

const expiryState = (date: string | null) => {
  if (!date) return null
  const days = Math.ceil((new Date(`${date}T12:00:00`).getTime() - Date.now()) / 86400000)
  if (days < 0) return { label: 'Vencido', className: 'danger' }
  if (days <= 7) return { label: `Vence en ${days} días`, className: 'warning' }
  return { label: formatDate(date), className: '' }
}

export function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [location, setLocation] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<InventoryItem | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()
  const { activeMember } = useActiveMember()

  useEffect(() => {
    apiData<InventoryItem[]>('/api/inventory?limit=200')
      .then(setItems)
      .catch((caught) => showToast(caught instanceof Error ? caught.message : 'No fue posible cargar el inventario.', 'error'))
      .finally(() => setLoading(false))
  }, [showToast])

  const filtered = useMemo(() => items.filter((item) => {
    const term = search.toLowerCase().trim()
    return (location === 'all' || item.location === location) && (!term || item.name.toLowerCase().includes(term) || item.category.toLowerCase().includes(term))
  }), [items, search, location])

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModalOpen(true) }
  const openEdit = (item: InventoryItem) => {
    setEditing(item)
    setForm({
      name: item.name, quantity: Number(item.quantity), unit: item.unit,
      purchase_date: item.purchase_date || '', expiration_date: item.expiration_date || '',
      location: item.location, category: item.category, notes: item.notes || '',
    })
    setModalOpen(true)
  }

  const save = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true)
    const payload = { ...form, member_id: activeMember?.id, purchase_date: form.purchase_date || null, expiration_date: form.expiration_date || null, notes: form.notes || null }
    try {
      if (editing) {
        const updated = await apiData<InventoryItem>(`/api/inventory/${editing.id}`, { method: 'PATCH', body: payload })
        setItems((current) => current.map((item) => item.id === updated.id ? updated : item))
        showToast('Alimento actualizado.')
      } else {
        const created = await apiData<InventoryItem>('/api/inventory', { method: 'POST', body: payload })
        setItems((current) => [created, ...current]); showToast('Alimento agregado.')
      }
      setModalOpen(false)
    } catch (caught) { showToast(caught instanceof Error ? caught.message : 'No fue posible guardar.', 'error') }
    finally { setSaving(false) }
  }

  const remove = async (item: InventoryItem) => {
    if (!window.confirm(`¿Eliminar “${item.name}” del inventario?`)) return
    await api(`/api/inventory/${item.id}`, { method: 'DELETE' })
    setItems((current) => current.filter((row) => row.id !== item.id)); showToast('Alimento eliminado.')
  }

  return (
    <div className="page-stack">
      <section className="page-heading"><div><span className="eyebrow">Alimentos</span><h2>Inventario</h2><p>Controla existencias, ubicaciones y fechas de vencimiento.</p></div><button className="button primary" onClick={openCreate}><Plus size={18} /> Agregar alimento</button></section>
      <section className="toolbar-card"><div className="search-field"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar alimentos…" /></div><select className="compact-select" value={location} onChange={(event) => setLocation(event.target.value)}><option value="all">Todas las ubicaciones</option><option value="refrigerador">Refrigerador</option><option value="congelador">Congelador</option><option value="despensa">Despensa</option><option value="otro">Otro</option></select></section>

      {loading ? <Loading /> : filtered.length ? (
        <section className="cards-grid">
          {filtered.map((item) => {
            const expiry = expiryState(item.expiration_date)
            return <article className="inventory-card" key={item.id}>
              <div className="inventory-card-top"><div className="inventory-icon"><PackageOpen size={22} /></div><div className="item-actions"><button className="icon-button" onClick={() => openEdit(item)}><Edit3 size={17} /></button><button className="icon-button danger" onClick={() => void remove(item)}><Trash2 size={17} /></button></div></div>
              <span className="eyebrow">{item.category}</span><h3>{item.name}</h3><strong className="inventory-quantity">{item.quantity} {item.unit}</strong>
              <div className="inventory-meta"><span>Ubicación <b>{item.location}</b></span><span>Compra <b>{formatDate(item.purchase_date)}</b></span></div>
              {expiry && <div className={`expiry-banner ${expiry.className}`}><AlertTriangle size={16} /> {expiry.label}</div>}
            </article>
          })}
        </section>
      ) : <EmptyState icon={<PackageOpen size={30} />} title="Inventario vacío" description="Agrega alimentos para comenzar a controlar sus cantidades." />}

      <Modal open={modalOpen} title={editing ? 'Editar alimento' : 'Agregar alimento'} onClose={() => setModalOpen(false)} size="large">
        <form className="form-grid" onSubmit={save}>
          <label className="field full-span"><span>Nombre</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
          <label className="field"><span>Cantidad</span><input type="number" min="0" step="0.001" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) })} required /></label>
          <label className="field"><span>Unidad</span><input value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} required /></label>
          <label className="field"><span>Fecha de compra</span><input type="date" value={form.purchase_date} onChange={(event) => setForm({ ...form, purchase_date: event.target.value })} /></label>
          <label className="field"><span>Fecha de vencimiento</span><input type="date" value={form.expiration_date} onChange={(event) => setForm({ ...form, expiration_date: event.target.value })} /></label>
          <label className="field"><span>Ubicación</span><select value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value as InventoryItem['location'] })}><option value="refrigerador">Refrigerador</option><option value="congelador">Congelador</option><option value="despensa">Despensa</option><option value="otro">Otro</option></select></label>
          <label className="field"><span>Categoría</span><input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label>
          <label className="field full-span"><span>Notas</span><textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
          <div className="form-actions full-span"><button type="button" className="button ghost" onClick={() => setModalOpen(false)}>Cancelar</button><button className="button primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button></div>
        </form>
      </Modal>
    </div>
  )
}
