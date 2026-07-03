import { useEffect, useRef, useState } from 'react'
import {
  Bot,
  CheckSquare2,
  ChevronRight,
  CircleDollarSign,
  Command,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PackageOpen,
  Search,
  Settings,
  ShoppingCart,
  Sparkles,
  Sun,
  X,
  Brain,
} from 'lucide-react'
import type { SearchResult, View } from '../lib/types'
import { apiData } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { Modal } from './Modal'
import { useHousehold } from '../context/HouseholdContext'

const navigation: Array<{ id: View; label: string; icon: React.ReactNode }> = [
  { id: 'dashboard', label: 'Inicio', icon: <LayoutDashboard size={20} /> },
  { id: 'chat', label: 'Asistente', icon: <Bot size={20} /> },
  { id: 'tasks', label: 'Tareas', icon: <CheckSquare2 size={20} /> },
  { id: 'shopping', label: 'Compras', icon: <ShoppingCart size={20} /> },
  { id: 'inventory', label: 'Inventario', icon: <PackageOpen size={20} /> },
  { id: 'finances', label: 'Dinero', icon: <CircleDollarSign size={20} /> },
  { id: 'memory', label: 'Memoria', icon: <Brain size={20} /> },
  { id: 'settings', label: 'Configuración', icon: <Settings size={20} /> },
]

const viewLabels: Record<View, string> = {
  dashboard: 'Panel principal',
  chat: 'Asistente con IA',
  tasks: 'Gestión de tareas',
  shopping: 'Lista de compras',
  inventory: 'Inventario de alimentos',
  finances: 'Control de dinero',
  memory: 'Memoria del asistente',
  settings: 'Configuración',
}

export function Layout({
  view,
  onViewChange,
  children,
}: {
  view: View
  onViewChange: (view: View) => void
  children: React.ReactNode
}) {
  const { user, signOut } = useAuth()
  const { member, household } = useHousehold()
  const { theme, toggleTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current)
    if (!search.trim()) {
      setResults([])
      return
    }
    timer.current = window.setTimeout(async () => {
      setSearching(true)
      try {
        setResults(await apiData<SearchResult[]>(`/api/search?q=${encodeURIComponent(search)}`))
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [search])

  const navigate = (next: View) => {
    onViewChange(next)
    setMobileOpen(false)
  }

  const openResult = (result: SearchResult) => {
    const map: Record<SearchResult['type'], View> = {
      task: 'tasks',
      shopping: 'shopping',
      inventory: 'inventory',
      finance: 'finances',
      memory: 'memory',
    }
    navigate(map[result.type])
    setSearchOpen(false)
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Sparkles size={22} /></div>
          <div><strong>Asistente IA</strong><span>Tu espacio personal</span></div>
          <button className="icon-button sidebar-close" onClick={() => setMobileOpen(false)}><X size={20} /></button>
        </div>
        <nav className="sidebar-nav">
          {navigation.map((item) => (
            <button key={item.id} className={view === item.id ? 'nav-item active' : 'nav-item'} onClick={() => navigate(item.id)}>
              {item.icon}<span>{item.label}</span>{view === item.id && <ChevronRight size={16} />}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="avatar">{(user?.email || 'U').slice(0, 1).toUpperCase()}</div>
            <div><strong>{user?.user_metadata?.full_name || 'Mi cuenta'}</strong><span>{user?.email}</span></div>
          </div>
          <button className="nav-item" onClick={() => signOut()}><LogOut size={20} /><span>Cerrar sesión</span></button>
        </div>
      </aside>

      {mobileOpen && <button className="sidebar-overlay" aria-label="Cerrar menú" onClick={() => setMobileOpen(false)} />}

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-title">
            <button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)}><Menu size={22} /></button>
            <div><span>{member ? `Hola, ${member.name}` : household?.name || 'Asistente personal'}</span><h1>{viewLabels[view]}</h1></div>
          </div>
          <div className="topbar-actions">
            <button className="search-trigger" onClick={() => setSearchOpen(true)}>
              <Search size={18} /><span>Buscar</span><kbd><Command size={12} />K</kbd>
            </button>
            <button className="icon-button theme-button" onClick={toggleTheme} aria-label="Cambiar tema">
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </header>
        <div className="page-content">{children}</div>
      </main>

      <Modal open={searchOpen} title="Búsqueda global" onClose={() => setSearchOpen(false)} size="large">
        <div className="global-search-input">
          <Search size={20} />
          <input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar tareas, compras, inventario, dinero o recuerdos…" />
        </div>
        <div className="search-results">
          {searching && <p className="muted">Buscando…</p>}
          {!searching && search && !results.length && <p className="muted">No se encontraron resultados.</p>}
          {results.map((result, index) => (
            <button key={`${result.type}-${index}`} className="search-result" onClick={() => openResult(result)}>
              <span className="result-type">{result.type}</span>
              <div><strong>{result.title}</strong><p>{result.subtitle}</p></div>
              <ChevronRight size={18} />
            </button>
          ))}
        </div>
      </Modal>
    </div>
  )
}
