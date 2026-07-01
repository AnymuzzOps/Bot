import { FormEvent, useState } from 'react'
import { Bot, LockKeyhole, Mail, ShieldCheck, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')

    try {
      if (mode === 'register') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName.trim() } },
        })
        if (signUpError) throw signUpError
        if (!data.session) {
          setMessage('Cuenta creada. Revisa tu correo para confirmar el acceso.')
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible iniciar sesión.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-hero">
        <div className="auth-hero-content">
          <div className="auth-logo"><Sparkles size={26} /></div>
          <span className="eyebrow">Asistente Personal con IA</span>
          <h1>Organiza tu vida desde una sola conversación.</h1>
          <p>Administra tareas, compras, alimentos, dinero y recuerdos con lenguaje natural.</p>
          <div className="auth-features">
            <div><Bot size={20} /><span>Asistente conectado a tus datos</span></div>
            <div><ShieldCheck size={20} /><span>Acceso privado protegido con Supabase</span></div>
            <div><LockKeyhole size={20} /><span>La clave de Groq nunca llega al navegador</span></div>
          </div>
        </div>
      </section>

      <section className="auth-panel">
        <form className="auth-card" onSubmit={submit}>
          <div className="auth-card-header">
            <div className="brand-mark"><Sparkles size={22} /></div>
            <div>
              <span>{mode === 'login' ? 'Bienvenido nuevamente' : 'Crea tu espacio personal'}</span>
              <h2>{mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</h2>
            </div>
          </div>

          {mode === 'register' && (
            <label className="field">
              <span>Nombre</span>
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Tu nombre" required />
            </label>
          )}

          <label className="field">
            <span>Correo electrónico</span>
            <div className="input-with-icon"><Mail size={18} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" required /></div>
          </label>

          <label className="field">
            <span>Contraseña</span>
            <div className="input-with-icon"><LockKeyhole size={18} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo 6 caracteres" minLength={6} required /></div>
          </label>

          {error && <div className="form-alert error">{error}</div>}
          {message && <div className="form-alert success">{message}</div>}

          <button className="button primary full" disabled={loading}>
            {loading ? 'Procesando…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>

          <p className="auth-switch">
            {mode === 'login' ? '¿Aún no tienes cuenta?' : '¿Ya tienes una cuenta?'}{' '}
            <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
              {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
            </button>
          </p>
        </form>
      </section>
    </div>
  )
}
