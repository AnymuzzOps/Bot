import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Brain, Edit3, Plus, Search, Star, Trash2 } from 'lucide-react'
import { api, apiData } from '../lib/api'
import type { Memory } from '../lib/types'
import { useToast } from '../context/ToastContext'
import { useActiveMember } from '../context/ActiveMemberContext'
import { Modal } from '../components/Modal'
import { EmptyState } from '../components/EmptyState'
import { Loading } from '../components/Loading'

const emptyForm = { key: '', value: '', category: 'general', importance: 3 }

export function MemoryPage() {
  const [items, setItems] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Memory | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()
  const { activeMember } = useActiveMember()

  useEffect(() => {
    apiData<Memory[]>('/api/memories?limit=200').then(setItems).catch((caught) => showToast(caught instanceof Error ? caught.message : 'No fue posible cargar la memoria.', 'error')).finally(() => setLoading(false))
  }, [showToast])

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim()
    return items.filter((item) => !term || item.key.toLowerCase().includes(term) || item.value.toLowerCase().includes(term) || item.category.toLowerCase().includes(term))
  }, [items, search])

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModalOpen(true) }
  const openEdit = (item: Memory) => { setEditing(item); setForm({ key: item.key, value: item.value, category: item.category, importance: item.importance }); setModalOpen(true) }
  const save = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true)
    try {
      if (editing) {
        const updated = await apiData<Memory>(`/api/memories/${editing.id}`, { method: 'PATCH', body: { ...form, member_id: activeMember?.id } })
        setItems((current) => current.map((item) => item.id === updated.id ? updated : item)); showToast('Recuerdo actualizado.')
      } else {
        const created = await apiData<Memory>('/api/memories', { method: 'POST', body: { ...form, member_id: activeMember?.id } })
        setItems((current) => [created, ...current.filter((item) => item.id !== created.id)]); showToast('Recuerdo guardado.')
      }
      setModalOpen(false)
    } catch (caught) { showToast(caught instanceof Error ? caught.message : 'No fue posible guardar.', 'error') }
    finally { setSaving(false) }
  }
  const remove = async (item: Memory) => {
    if (!window.confirm(`¿Olvidar “${item.key}”?`)) return
    await api(`/api/memories/${item.id}`, { method: 'DELETE' }); setItems((current) => current.filter((row) => row.id !== item.id)); showToast('Recuerdo eliminado.')
  }

  return (
    <div className="page-stack">
      <section className="page-heading"><div><span className="eyebrow">Contexto personal</span><h2>Memoria del asistente</h2><p>Información que la IA utiliza para personalizar futuras respuestas.</p></div><button className="button primary" onClick={openCreate}><Plus size={18} /> Nuevo recuerdo</button></section>
      <section className="info-banner"><Brain size={21} /><div><strong>Tú controlas la memoria.</strong><p>Puedes revisar, editar o eliminar cualquier dato guardado.</p></div></section>
      <section className="toolbar-card"><div className="search-field"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar recuerdos…" /></div></section>
      {loading ? <Loading /> : filtered.length ? <section className="cards-grid">{filtered.map((item) => <article className="memory-card" key={item.id}><div className="memory-top"><span className="badge">{item.category}</span><div className="importance">{Array.from({ length: item.importance }).map((_, index) => <Star key={index} size={13} fill="currentColor" />)}</div></div><h3>{item.key}</h3><p>{item.value}</p><div className="memory-actions"><button className="button ghost small" onClick={() => openEdit(item)}><Edit3 size={15} /> Editar</button><button className="icon-button danger" onClick={() => void remove(item)}><Trash2 size={17} /></button></div></article>)}</section> : <EmptyState icon={<Brain size={30} />} title="Aún no hay recuerdos" description="El asistente puede guardar preferencias, objetivos, hábitos y proyectos." />}
      <Modal open={modalOpen} title={editing ? 'Editar recuerdo' : 'Nuevo recuerdo'} onClose={() => setModalOpen(false)}>
        <form className="form-grid" onSubmit={save}><label className="field full-span"><span>Clave</span><input value={form.key} onChange={(event) => setForm({ ...form, key: event.target.value })} placeholder="Ej.: nombre, objetivo principal, proyecto actual" required /></label><label className="field full-span"><span>Información</span><textarea rows={5} value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} required /></label><label className="field"><span>Categoría</span><input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label><label className="field"><span>Importancia</span><select value={form.importance} onChange={(event) => setForm({ ...form, importance: Number(event.target.value) })}>{[1,2,3,4,5].map((value) => <option key={value} value={value}>{value}</option>)}</select></label><div className="form-actions full-span"><button type="button" className="button ghost" onClick={() => setModalOpen(false)}>Cancelar</button><button className="button primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar recuerdo'}</button></div></form>
      </Modal>
    </div>
  )
}
