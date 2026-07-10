import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowRight, CalendarDays, CheckSquare2, CircleDollarSign, Clock, PackageOpen, ShoppingCart, Sparkles } from 'lucide-react'
import { apiData } from '../lib/api'
import type { DashboardData, View, WorkShift } from '../lib/types'
import { formatDate, formatMoney } from '../lib/format'
import { Loading } from '../components/Loading'
import { StatCard } from '../components/StatCard'

export function DashboardPage({ onNavigate }: { onNavigate: (view: View) => void }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')
  const [calendarItems, setCalendarItems] = useState<WorkShift[]>([])

  useEffect(() => {
    apiData<DashboardData>('/api/dashboard')
      .then(setData)
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'No fue posible cargar el panel.'))

    const now = new Date()
    const currentMonth = now.toISOString().slice(0, 7)
    const nextMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1)).toISOString().slice(0, 7)
    Promise.all([
      apiData<WorkShift[]>(`/api/calendar?month=${currentMonth}`),
      apiData<WorkShift[]>(`/api/calendar?month=${nextMonth}`),
    ])
      .then(([current, next]) => setCalendarItems([...current, ...next]))
      .catch(() => setCalendarItems([]))
  }, [])

  if (!data && !error) return <Loading label="Preparando tu panel…" />
  if (error) return <div className="form-alert error">{error}</div>
  if (!data) return null

  const name = data.profile?.full_name?.split(' ')[0] || 'Hola'
  const currency = data.profile?.currency || 'CLP'
  const today = new Date().toISOString().slice(0, 10)
  const upcomingShifts = calendarItems.filter((item) => item.shift_date >= today).slice(0, 3)
  const todayShift = calendarItems.find((item) => item.shift_date === today)
  const nextDayOff = calendarItems.find((item) => item.shift_date >= today && item.is_day_off)

  return (
    <div className="page-stack">
      <section className="welcome-card">
        <div>
          <span className="eyebrow"><Sparkles size={15} /> Tu resumen personal</span>
          <h2>Hola, {name}. ¿Qué organizamos hoy?</h2>
          <p>Puedes pedirme cosas como “agrega estudiar inglés mañana” o “¿cuánto gasté este mes?”.</p>
        </div>
        <button className="button primary" onClick={() => onNavigate('chat')}>Hablar con el asistente <ArrowRight size={18} /></button>
      </section>

      <section className="stats-grid">
        <StatCard icon={<CheckSquare2 size={22} />} label="Tareas pendientes" value={data.pending_tasks.length} hint="Próximas por completar" />
        <StatCard icon={<ShoppingCart size={22} />} label="Compras pendientes" value={data.pending_shopping.length} hint="Productos sin comprar" />
        <StatCard icon={<PackageOpen size={22} />} label="Próximos a vencer" value={data.expiring_inventory.length} hint="Dentro de 14 días" />
        <StatCard icon={<CircleDollarSign size={22} />} label="Saldo actual" value={formatMoney(data.finances.current_balance, currency)} hint={`${formatMoney(data.finances.income, currency)} ingresado este mes`} />
      </section>

      <section className="dashboard-grid">
        <article className="panel-card">
          <div className="panel-header"><div><span>Prioridades</span><h3>Tareas pendientes</h3></div><button className="text-button" onClick={() => onNavigate('tasks')}>Ver todas</button></div>
          <div className="compact-list">
            {data.pending_tasks.length ? data.pending_tasks.map((task) => (
              <div className="compact-row" key={task.id}>
                <span className={`priority-dot ${task.priority}`} />
                <div><strong>{task.title}</strong><p>{task.due_date ? formatDate(task.due_date) : 'Sin fecha límite'}</p></div>
              </div>
            )) : <p className="muted">No tienes tareas pendientes.</p>}
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-header"><div><span>Compras</span><h3>Lista pendiente</h3></div><button className="text-button" onClick={() => onNavigate('shopping')}>Abrir lista</button></div>
          <div className="compact-list">
            {data.pending_shopping.length ? data.pending_shopping.map((item) => (
              <div className="compact-row" key={item.id}>
                <ShoppingCart size={17} />
                <div><strong>{item.name}</strong><p>{item.quantity} {item.unit} · {item.category}</p></div>
              </div>
            )) : <p className="muted">La lista de compras está vacía.</p>}
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-header"><div><span>Inventario</span><h3>Vencimientos cercanos</h3></div><button className="text-button" onClick={() => onNavigate('inventory')}>Ver inventario</button></div>
          <div className="compact-list">
            {data.expiring_inventory.length ? data.expiring_inventory.map((item) => (
              <div className="compact-row" key={item.id}>
                <AlertTriangle size={17} />
                <div><strong>{item.name}</strong><p>Vence {formatDate(item.expiration_date)} · {item.location}</p></div>
              </div>
            )) : <p className="muted">No hay alimentos próximos a vencer.</p>}
          </div>
        </article>

        <article className="panel-card finance-summary-card">
          <div className="panel-header"><div><span>Dinero</span><h3>Resumen mensual</h3></div><button className="text-button" onClick={() => onNavigate('finances')}>Ver detalle</button></div>
          <div className="money-summary">
            <div><span>Ingresos</span><strong className="positive">{formatMoney(data.finances.income, currency)}</strong></div>
            <div><span>Gastos</span><strong className="negative">{formatMoney(data.finances.expense, currency)}</strong></div>
            <div className="balance-line"><span>Balance del mes</span><strong>{formatMoney(data.finances.balance, currency)}</strong></div>
          </div>
        </article>
      </section>

      <section className="panel-card calendar-summary-card">
        <div className="panel-header"><div><span>Calendario</span><h3>Horario laboral</h3></div><button className="text-button" onClick={() => onNavigate('calendar')}>Ver calendario</button></div>
        <div className="calendar-summary-grid">
          <div className="calendar-summary-tile"><CalendarDays size={18} /><span>Turno de hoy</span><strong>{todayShift ? todayShift.label : 'Sin turno'}</strong><p>{todayShift && !todayShift.is_day_off ? `${(todayShift.start_time || '').slice(0, 5)}–${(todayShift.end_time || '').slice(0, 5)}` : todayShift?.is_day_off ? 'Día libre' : 'No hay registros para hoy.'}</p></div>
          <div className="calendar-summary-tile"><Clock size={18} /><span>Día libre próximo</span><strong>{nextDayOff ? formatDate(nextDayOff.shift_date) : 'Sin día libre'}</strong><p>{nextDayOff?.notes || 'Marca un día libre desde el calendario.'}</p></div>
          <div className="calendar-summary-list">
            <span>Próximos turnos</span>
            {upcomingShifts.length ? upcomingShifts.map((shift) => <div key={shift.id}><strong>{shift.label}</strong><p>{formatDate(shift.shift_date)}{shift.is_day_off ? ' · Día libre' : ` · ${(shift.start_time || '').slice(0, 5)}–${(shift.end_time || '').slice(0, 5)}`}</p></div>) : <p className="muted">Aún no hay turnos próximos este mes.</p>}
          </div>
        </div>
      </section>
    </div>
  )
}
