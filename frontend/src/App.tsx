import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import { useActiveMember } from './context/ActiveMemberContext'
import type { View } from './lib/types'
import { AuthPage } from './pages/AuthPage'
import { DashboardPage } from './pages/DashboardPage'
import { ChatPage } from './pages/ChatPage'
import { TasksPage } from './pages/TasksPage'
import { ShoppingPage } from './pages/ShoppingPage'
import { InventoryPage } from './pages/InventoryPage'
import { FinancesPage } from './pages/FinancesPage'
import { MemoryPage } from './pages/MemoryPage'
import { SettingsPage } from './pages/SettingsPage'
import { Layout } from './components/Layout'

const validViews: View[] = ['dashboard', 'chat', 'tasks', 'shopping', 'inventory', 'finances', 'memory', 'settings']

const readHash = (): View => {
  const value = window.location.hash.replace('#/', '') as View
  return validViews.includes(value) ? value : 'dashboard'
}

export function App() {
  const { user, loading } = useAuth()
  const { members, activeMember, loading: memberLoading, needsSelection, selectInitialMember } = useActiveMember()
  const [view, setView] = useState<View>(readHash)

  useEffect(() => {
    const onHash = () => setView(readHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const navigate = (next: View) => {
    window.location.hash = `/${next}`
    setView(next)
  }

  if (loading || (user && memberLoading)) {
    return <div className="boot-screen"><div className="brand-mark"><Sparkles size={24} /></div><span className="spinner" /><p>Cargando tu asistente…</p></div>
  }

  if (!user) return <AuthPage />

  if (needsSelection) {
    return (
      <div className="member-select-page">
        <section className="member-select-card">
          <div className="brand-mark"><Sparkles size={24} /></div>
          <span className="eyebrow">Cuenta compartida</span>
          <h1>¿Quién está usando el asistente?</h1>
          <p>Elige una vez en este dispositivo para personalizar la memoria y autoría.</p>
          <div className="member-card-grid">
            {members.map((member) => (
              <button key={member.id} className="member-card-option" onClick={() => selectInitialMember(member)}>
                <span className="member-avatar">{member.avatar || member.name.slice(0, 1)}</span>
                <strong>{member.name}</strong>
              </button>
            ))}
          </div>
        </section>
      </div>
    )
  }

  if (!activeMember) return <div className="boot-screen"><span className="spinner" /><p>Preparando perfiles…</p></div>

  const page = {
    dashboard: <DashboardPage onNavigate={navigate} />,
    chat: <ChatPage />,
    tasks: <TasksPage />,
    shopping: <ShoppingPage />,
    inventory: <InventoryPage />,
    finances: <FinancesPage />,
    memory: <MemoryPage />,
    settings: <SettingsPage />,
  }[view]

  return <Layout view={view} onViewChange={navigate}>{page}</Layout>
}
