import { CSSProperties, FormEvent, useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Edit3, Plus, Trash2 } from 'lucide-react'
import { api, apiData } from '../lib/api'
import type { WorkShift } from '../lib/types'
import { formatDate } from '../lib/format'
import { useToast } from '../context/ToastContext'
import { Modal } from '../components/Modal'
import { EmptyState } from '../components/EmptyState'
import { Loading } from '../components/Loading'
import { getChileCurrentYearMonth, getChileTodayISO, shiftYearMonth } from '../lib/dates'

const weekDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const shortWeekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const shiftDefaults = {
  morning: { label: 'MAÑANA', start_time: '06:00', end_time: '14:00', color: '#8FD8F7' },
  afternoon: { label: 'TARDE', start_time: '12:00', end_time: '19:00', color: '#F4A8C7' },
  closing: { label: 'CIERRE', start_time: '15:00', end_time: '22:00', color: '#E7A0F2' },
  day_off: { label: 'DÍA LIBRE', start_time: '', end_time: '', color: '#AAF0AB' },
  custom: { label: 'PERSONALIZADO', start_time: '', end_time: '', color: '#99D89A' },
} satisfies Record<WorkShift['shift_type'], { label: string; start_time: string; end_time: string; color: string }>

const emptyForm = {
  shift_date: '',
  shift_type: 'morning' as WorkShift['shift_type'],
  label: 'MAÑANA',
  start_time: '06:00',
  end_time: '14:00',
  color: '#8FD8F7',
  notes: '',
  is_day_off: false,
}

const dateKey = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
const formatVisibleMonth = (visibleMonth: string) => {
  const [year, monthNumber] = visibleMonth.split('-').map(Number)
  const title = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, monthNumber - 1, 15, 12)))
  return title.charAt(0).toUpperCase() + title.slice(1)
}
const shiftTime = (value: string | null) => value ? value.slice(0, 5) : ''

const startOfCalendar = (visibleMonth: string) => {
  const [year, monthNumber] = visibleMonth.split('-').map(Number)
  const first = new Date(Date.UTC(year, monthNumber - 1, 1))
  const day = first.getUTCDay() || 7
  first.setUTCDate(first.getUTCDate() - (day - 1))
  return first
}

const weekNumber = (date: Date) => {
  const current = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = current.getUTCDay() || 7
  current.setUTCDate(current.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(current.getUTCFullYear(), 0, 1))
  return Math.ceil((((current.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

const buildCalendar = (visibleMonth: string) => {
  const start = startOfCalendar(visibleMonth)
  return Array.from({ length: 6 }, (_, weekIndex) => Array.from({ length: 7 }, (_, dayIndex) => {
    const current = new Date(start)
    current.setUTCDate(start.getUTCDate() + weekIndex * 7 + dayIndex)
    return current
  }))
}

function ShiftBadge({ shift }: { shift: WorkShift }) {
  const background = shift.color || shiftDefaults[shift.shift_type].color
  return (
    <div className={`shift-badge shift-${shift.shift_type}`} style={{ '--shift-color': background } as CSSProperties}>
      <strong>{shift.is_day_off ? 'DÍA LIBRE' : shift.label}</strong>
      {!shift.is_day_off && (shift.start_time || shift.end_time) && <span>{shiftTime(shift.start_time)}–{shiftTime(shift.end_time)}</span>}
      {shift.notes && <small>{shift.notes}</small>}
    </div>
  )
}

export function CalendarPage() {
  const [visibleMonth, setVisibleMonth] = useState(() => getChileCurrentYearMonth())
  const [items, setItems] = useState<WorkShift[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<WorkShift | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()

  const load = async () => {
    setLoading(true)
    try {
      setItems(await apiData<WorkShift[]>(`/api/calendar?month=${visibleMonth}`))
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : 'No fue posible cargar el calendario.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [visibleMonth])

  const shiftsByDate = useMemo(() => items.reduce<Record<string, WorkShift[]>>((acc, item) => {
    acc[item.shift_date] = [...(acc[item.shift_date] || []), item]
    return acc
  }, {}), [items])

  const weeks = useMemo(() => buildCalendar(visibleMonth), [visibleMonth])
  const today = getChileTodayISO()
  const isCurrentMonth = visibleMonth === getChileCurrentYearMonth()

  const setShiftType = (shift_type: WorkShift['shift_type']) => {
    const defaults = shiftDefaults[shift_type]
    setForm((current) => ({
      ...current,
      shift_type,
      label: defaults.label,
      start_time: defaults.start_time,
      end_time: defaults.end_time,
      color: defaults.color,
      is_day_off: shift_type === 'day_off',
    }))
  }

  const openCreate = (date: string) => {
    setEditing(null)
    setForm({ ...emptyForm, shift_date: date })
    setModalOpen(true)
  }

  const openEdit = (shift: WorkShift) => {
    setEditing(shift)
    setForm({
      shift_date: shift.shift_date,
      shift_type: shift.shift_type,
      label: shift.label,
      start_time: shiftTime(shift.start_time),
      end_time: shiftTime(shift.end_time),
      color: shift.color || shiftDefaults[shift.shift_type].color,
      notes: shift.notes || '',
      is_day_off: shift.is_day_off,
    })
    setModalOpen(true)
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...form,
        label: form.is_day_off ? 'DÍA LIBRE' : form.label,
        shift_type: form.is_day_off ? 'day_off' : form.shift_type,
        start_time: form.is_day_off ? null : form.start_time || null,
        end_time: form.is_day_off ? null : form.end_time || null,
        color: form.color || null,
        notes: form.notes || null,
      }
      if (editing) {
        const updated = await apiData<WorkShift>(`/api/calendar/${editing.id}`, { method: 'PATCH', body: payload })
        setItems((current) => current.map((item) => item.id === updated.id ? updated : item))
        showToast('Turno actualizado.')
      } else {
        const created = await apiData<WorkShift>('/api/calendar', { method: 'POST', body: payload })
        setItems((current) => [...current, created].sort((a, b) => a.shift_date.localeCompare(b.shift_date)))
        showToast('Turno creado.')
      }
      setModalOpen(false)
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : 'No fue posible guardar el turno.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!editing || !window.confirm('¿Eliminar este turno?')) return
    await api(`/api/calendar/${editing.id}`, { method: 'DELETE' })
    setItems((current) => current.filter((item) => item.id !== editing.id))
    setModalOpen(false)
    showToast('Turno eliminado.')
  }

  const goToday = () => setVisibleMonth(getChileCurrentYearMonth())

  return (
    <div className="page-stack calendar-page">
      <section className="page-heading">
        <div><span className="eyebrow"><CalendarDays size={15} /> Horario laboral</span><h2>Calendario</h2><p>Configura turnos, días libres y notas compartidas por hogar.</p></div>
        <div className="calendar-actions"><button className="button ghost" onClick={goToday}>Hoy</button><button className="button primary" onClick={() => openCreate(today)}><Plus size={18} /> Nuevo turno</button></div>
      </section>

      <section className="calendar-shell">
        <div className="calendar-month-header">
          <button className="icon-button" onClick={() => setVisibleMonth((current) => shiftYearMonth(current, -1))} aria-label="Mes anterior"><ChevronLeft size={20} /></button>
          <div><span>{isCurrentMonth ? 'Mes actual' : 'Mes visible'}</span><h3>{formatVisibleMonth(visibleMonth)}</h3></div>
          <button className="icon-button" onClick={() => setVisibleMonth((current) => shiftYearMonth(current, 1))} aria-label="Mes siguiente"><ChevronRight size={20} /></button>
        </div>

        {loading ? <Loading /> : (
          <>
            <div className="calendar-grid" role="grid">
              <div className="calendar-week-label">Sem</div>
              {weekDays.map((day) => <div className="calendar-day-name" key={day}>{day}</div>)}
              {weeks.map((week) => (
                <div className="calendar-week-row" key={dateKey(week[0])}>
                  <div className="calendar-week-number">{weekNumber(week[0])}</div>
                  {week.map((day) => {
                    const key = dateKey(day)
                    const dayShifts = shiftsByDate[key] || []
                    const outside = key.slice(0, 7) !== visibleMonth
                    return (
                      <button className={`calendar-day ${outside ? 'outside' : ''} ${key === today ? 'today' : ''}`} key={key} onClick={() => dayShifts[0] ? openEdit(dayShifts[0]) : openCreate(key)}>
                        <span className="calendar-day-number">{day.getUTCDate()}</span>
                        <span className="calendar-mobile-date">{shortWeekDays[(day.getUTCDay() + 6) % 7]} · {formatDate(key)}</span>
                        <span className="calendar-shifts">{dayShifts.map((shift) => <ShiftBadge key={shift.id} shift={shift} />)}</span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
            {!items.length && <EmptyState icon={<CalendarDays size={30} />} title="Sin turnos este mes" description="Haz click en un día para crear un turno o marcar día libre." />}
          </>
        )}
      </section>

      <Modal open={modalOpen} title={editing ? 'Editar turno' : 'Nuevo turno'} onClose={() => setModalOpen(false)}>
        <form className="form-grid" onSubmit={save}>
          <label className="field"><span>Fecha</span><input type="date" value={form.shift_date} onChange={(event) => setForm({ ...form, shift_date: event.target.value })} required /></label>
          <label className="field"><span>Tipo</span><select value={form.shift_type} onChange={(event) => setShiftType(event.target.value as WorkShift['shift_type'])}><option value="morning">Mañana</option><option value="afternoon">Tarde</option><option value="closing">Cierre</option><option value="day_off">Día libre</option><option value="custom">Personalizado</option></select></label>
          <label className="field full-span checkbox-field"><input type="checkbox" checked={form.is_day_off} onChange={(event) => setForm({ ...form, is_day_off: event.target.checked, shift_type: event.target.checked ? 'day_off' : form.shift_type, label: event.target.checked ? 'DÍA LIBRE' : form.label })} /><span>Marcar como día libre</span></label>
          <label className="field"><span>Nombre del turno</span><input value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} disabled={form.is_day_off} required /></label>
          <label className="field"><span>Color</span><input type="color" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} /></label>
          <label className="field"><span>Inicio</span><input type="time" value={form.start_time} onChange={(event) => setForm({ ...form, start_time: event.target.value })} disabled={form.is_day_off} /></label>
          <label className="field"><span>Término</span><input type="time" value={form.end_time} onChange={(event) => setForm({ ...form, end_time: event.target.value })} disabled={form.is_day_off} /></label>
          <label className="field full-span"><span>Nota opcional</span><textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
          <div className="form-actions full-span split-actions">
            {editing && <button type="button" className="button ghost danger-text" onClick={() => void remove()}><Trash2 size={16} /> Eliminar</button>}
            <span />
            <button type="button" className="button ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
            <button className="button primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar turno'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
