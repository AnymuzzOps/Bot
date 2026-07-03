import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Check, Edit3, Plus, Search, ShoppingBag, Trash2 } from 'lucide-react'
import { api, apiData } from '../lib/api'
import type { ShoppingItem } from '../lib/types'
import { classNames } from '../lib/format'
import { useToast } from '../context/ToastContext'
import { useActiveMember } from '../context/ActiveMemberContext'
import { Modal } from '../components/Modal'
import { EmptyState } from '../components/EmptyState'
import { Loading } from '../components/Loading'

const emptyForm = { name: '', quantity: 1, unit: 'unidad', category: 'General' }

export function ShoppingPage() {
  const [items, setItems] = useState<ShoppingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'purchased'>('pending')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ShoppingItem | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()
  const { activeMember } = useActiveMember()

  useEffect(() => {
    apiData<ShoppingItem[]>('/api/shopping?limit=200')
      .then(setItems)
      .catch((caught) => showToast(caught instanceof Error ? caught.message : 'No fue posible cargar la lista.', 'error'))
      .finally(() => setLoading(false))
  }, [showToast])

  const filtered = useMemo(() => items.filter((item) => {
    const stateMatch = filter === 'all' || (filter === 'pending' ? !item.purchased : item.purchased)
    const term = search.toLowerCase().trim()
    return stateMatch && (!term || item.name.toLowerCase().includes(term) || item.category.toLowerCase().includes(term))
  }), [items, filter, search])

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModalOpen(true) }
  const openEdit = (item: ShoppingItem) => {
    setEditing(item)
    setForm({ name: item.name, quantity: Number(item.quantity), unit: item.unit, category: item.category })
    setModalOpen(true)
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      if (editing) {
        const updated = await apiData<ShoppingItem>(`/api/shopping/${editing.id}`, { method: 'PATCH', body: { ...form } })
        setItems((current) => current.map((item) => item.id === updated.id ? updated : item))
        showToast('Producto actualizado.')
      } else {
        const created = await apiData<ShoppingItem>('/api/shopping', { method: 'POST', body: { ...form } })
        setItems((current) => [created, ...current])
        showToast('Producto agregado.')
      }
      setModalOpen(false)
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : 'No fue posible guardar.', 'error')
    } finally { setSaving(false) }
  }

  const toggle = async (item: ShoppingItem) => {
    try {
      const updated = await apiData<ShoppingItem>(`/api/shopping/${item.id}`, { method: 'PATCH', body: { purchased: !item.purchased } })
      setItems((current) => current.map((row) => row.id === updated.id ? updated : row))
      showToast(updated.purchased ? 'Marcado como comprado.' : 'Devuelto a pendientes.')
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : 'No fue posible actualizar.', 'error')
    }
  }

  const remove = async (item: ShoppingItem) => {
    if (!window.confirm(`¿Eliminar “${item.name}”?`)) return
    await api(`/api/shopping/${item.id}`, { method: 'DELETE' })
    setItems((current) => current.filter((row) => row.id !== item.id))
    showToast('Producto eliminado.')
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div><span className="eyebrow">Compras</span><h2>Lista de compras</h2><p>Organiza productos, cantidades y categorías.</p></div>
        <button className="button primary" onClick={openCreate}><Plus size={18} /> Agregar producto</button>
      </section>

      <section className="toolbar-card">
        <div className="search-field"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar productos…" /></div>
        <div className="segmented">
          {(['pending', 'purchased', 'all'] as const).map((value) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{value === 'pending' ? 'Pendientes' : value === 'purchased' ? 'Comprados' : 'Todos'}</button>)}
        </div>
      </section>

      {loading ? <Loading /> : filtered.length ? (
        <section className="item-list two-column-list">
          {filtered.map((item) => (
            <article className={classNames('item-card', item.purchased && 'completed')} key={item.id}>
              <button className={classNames('check-button', item.purchased && 'checked')} onClick={() => void toggle(item)}>{item.purchased && <Check size={17} />}</button>
              <div className="item-main">
                <div className="item-title-line"><h3>{item.name}</h3><span className="badge">{item.category}</span></div>
                <p>{item.quantity} {item.unit}</p>
                <div className="item-meta"><span>{item.purchased ? 'Comprado' : 'Pendiente'}</span></div>
              </div>
              <div className="item-actions">
                <button className="icon-button" onClick={() => openEdit(item)}><Edit3 size={18} /></button>
                <button className="icon-button danger" onClick={() => void remove(item)}><Trash2 size={18} /></button>
              </div>
            </article>
          ))}
        </section>
      ) : <EmptyState icon={<ShoppingBag size={30} />} title="No hay productos" description="Agrega algo a tu lista de compras." />}

      <Modal open={modalOpen} title={editing ? 'Editar producto' : 'Agregar producto'} onClose={() => setModalOpen(false)}>
        <form className="form-grid" onSubmit={save}>
          <label className="field full-span"><span>Producto</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
          <label className="field"><span>Cantidad</span><input type="number" min="0.001" step="0.001" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) })} required /></label>
          <label className="field"><span>Unidad</span><input value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} required /></label>
          <label className="field full-span"><span>Categoría</span><input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label>
          <div className="form-actions full-span"><button type="button" className="button ghost" onClick={() => setModalOpen(false)}>Cancelar</button><button className="button primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button></div>
        </form>
      </Modal>
    </div>
  )
}
