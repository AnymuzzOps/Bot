import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Check, CheckCircle2, CheckSquare2, Edit3, Plus, Search, Trash2 } from 'lucide-react'
import { api, apiData } from '../lib/api'
import type { Task } from '../lib/types'
import { classNames, formatDate } from '../lib/format'
import { useToast } from '../context/ToastContext'
import { useActiveMember } from '../context/ActiveMemberContext'
import { Modal } from '../components/Modal'
import { EmptyState } from '../components/EmptyState'
import { Loading } from '../components/Loading'

const emptyForm = {
  title: '',
  description: '',
  priority: 'medium' as Task['priority'],
  due_date: '',
}

export function TasksPage() {
  const [items, setItems] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | Task['status']>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()
  const { activeMember } = useActiveMember()

  const load = async () => {
    setLoading(true)
    try {
      setItems(await apiData<Task[]>('/api/tasks?limit=200'))
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : 'No fue posible cargar las tareas.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => items.filter((item) => {
    const matchesFilter = filter === 'all' || item.status === filter
    const term = search.toLowerCase().trim()
    const matchesSearch = !term || item.title.toLowerCase().includes(term) || (item.description || '').toLowerCase().includes(term)
    return matchesFilter && matchesSearch
  }), [items, filter, search])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (item: Task) => {
    setEditing(item)
    setForm({
      title: item.title,
      description: item.description || '',
      priority: item.priority,
      due_date: item.due_date ? item.due_date.slice(0, 16) : '',
    })
    setModalOpen(true)
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...form,
        member_id: activeMember?.id,
        description: form.description || null,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
      }
      if (editing) {
        const updated = await apiData<Task>(`/api/tasks/${editing.id}`, { method: 'PATCH', body: payload })
        setItems((current) => current.map((item) => item.id === updated.id ? updated : item))
        showToast('Tarea actualizada.')
      } else {
        const created = await apiData<Task>('/api/tasks', { method: 'POST', body: payload })
        setItems((current) => [created, ...current])
        showToast('Tarea creada.')
      }
      setModalOpen(false)
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : 'No fue posible guardar.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (item: Task) => {
    const status = item.status === 'completed' ? 'pending' : 'completed'
    try {
      const updated = await apiData<Task>(`/api/tasks/${item.id}`, { method: 'PATCH', body: { status } })
      setItems((current) => current.map((row) => row.id === updated.id ? updated : row))
      showToast(status === 'completed' ? 'Tarea completada.' : 'Tarea reabierta.')
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : 'No fue posible actualizar.', 'error')
    }
  }

  const remove = async (item: Task) => {
    if (!window.confirm(`¿Eliminar “${item.title}”?`)) return
    await api(`/api/tasks/${item.id}`, { method: 'DELETE' })
    setItems((current) => current.filter((row) => row.id !== item.id))
    showToast('Tarea eliminada.')
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div><span className="eyebrow">Organización</span><h2>Tus tareas</h2><p>Crea prioridades y fechas límite para mantener el foco.</p></div>
        <button className="button primary" onClick={openCreate}><Plus size={18} /> Nueva tarea</button>
      </section>

      <section className="toolbar-card">
        <div className="search-field"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar tareas…" /></div>
        <div className="segmented">
          {(['all', 'pending', 'completed'] as const).map((value) => (
            <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>
              {value === 'all' ? 'Todas' : value === 'pending' ? 'Pendientes' : 'Completadas'}
            </button>
          ))}
        </div>
      </section>

      {loading ? <Loading /> : filtered.length ? (
        <section className="item-list">
          {filtered.map((item) => (
            <article className={classNames('item-card', item.status === 'completed' && 'completed')} key={item.id}>
              <button className={classNames('check-button', item.status === 'completed' && 'checked')} onClick={() => void toggle(item)} aria-label="Cambiar estado">
                {item.status === 'completed' && <Check size={17} />}
              </button>
              <div className="item-main">
                <div className="item-title-line"><h3>{item.title}</h3><span className={`badge priority-${item.priority}`}>{item.priority === 'high' ? 'Alta' : item.priority === 'low' ? 'Baja' : 'Media'}</span></div>
                {item.description && <p>{item.description}</p>}
                <div className="item-meta"><span>{item.due_date ? `Vence ${formatDate(item.due_date)}` : 'Sin fecha límite'}</span><span>{item.status === 'completed' ? 'Completada' : 'Pendiente'}</span></div>
              </div>
              <div className="item-actions">
                <button className="icon-button" onClick={() => openEdit(item)} aria-label="Editar"><Edit3 size={18} /></button>
                <button className="icon-button danger" onClick={() => void remove(item)} aria-label="Eliminar"><Trash2 size={18} /></button>
              </div>
            </article>
          ))}
        </section>
      ) : <EmptyState icon={<CheckCircle2 size={30} />} title="No hay tareas aquí" description="Crea una nueva tarea o cambia los filtros." />}

      <Modal open={modalOpen} title={editing ? 'Editar tarea' : 'Nueva tarea'} onClose={() => setModalOpen(false)}>
        <form className="form-grid" onSubmit={save}>
          <label className="field full-span"><span>Título</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required maxLength={240} /></label>
          <label className="field full-span"><span>Descripción</span><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={4} /></label>
          <label className="field"><span>Prioridad</span><select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as Task['priority'] })}><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option></select></label>
          <label className="field"><span>Fecha límite</span><input type="datetime-local" value={form.due_date} onChange={(event) => setForm({ ...form, due_date: event.target.value })} /></label>
          <div className="form-actions full-span"><button type="button" className="button ghost" onClick={() => setModalOpen(false)}>Cancelar</button><button className="button primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar tarea'}</button></div>
        </form>
      </Modal>
    </div>
  )
}
