import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react'
import { Download, Moon, Save, Upload, UserRound } from 'lucide-react'
import { api, apiData } from '../lib/api'
import type { Profile } from '../lib/types'
import { useToast } from '../context/ToastContext'
import { useTheme } from '../context/ThemeContext'
import { Loading } from '../components/Loading'

export function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [form, setForm] = useState({ full_name: '', timezone: 'America/Santiago', currency: 'CLP' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge')
  const fileRef = useRef<HTMLInputElement>(null)
  const { showToast } = useToast()
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    apiData<Profile>('/api/profile')
      .then((data) => {
        setProfile(data)
        setForm({ full_name: data.full_name || '', timezone: data.timezone, currency: data.currency })
      })
      .catch((caught) => showToast(caught instanceof Error ? caught.message : 'No fue posible cargar el perfil.', 'error'))
      .finally(() => setLoading(false))
  }, [showToast])

  const save = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true)
    try {
      const updated = await apiData<Profile>('/api/profile', { method: 'PATCH', body: form })
      setProfile(updated); showToast('Perfil actualizado.')
    } catch (caught) { showToast(caught instanceof Error ? caught.message : 'No fue posible guardar.', 'error') }
    finally { setSaving(false) }
  }

  const exportBackup = async () => {
    try {
      const payload = await api<Record<string, unknown>>('/api/export')
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `asistente-respaldo-${new Date().toISOString().slice(0, 10)}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      showToast('Respaldo exportado.')
    } catch (caught) { showToast(caught instanceof Error ? caught.message : 'No fue posible exportar.', 'error') }
  }

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text())
      const data = parsed.data || parsed
      await api('/api/import', { method: 'POST', body: { mode: importMode, data } })
      showToast('Respaldo importado. Recarga las secciones para ver los cambios.')
    } catch (caught) { showToast(caught instanceof Error ? caught.message : 'El archivo no es un respaldo válido.', 'error') }
    finally { event.target.value = '' }
  }

  if (loading) return <Loading />

  return (
    <div className="page-stack settings-layout">
      <section className="page-heading"><div><span className="eyebrow">Cuenta</span><h2>Configuración</h2><p>Personaliza tu perfil, apariencia y respaldos.</p></div></section>

      <section className="settings-grid">
        <article className="panel-card">
          <div className="settings-section-title"><UserRound size={21} /><div><h3>Perfil</h3><p>Datos usados para personalizar el asistente.</p></div></div>
          <form className="form-grid" onSubmit={save}>
            <label className="field full-span"><span>Nombre</span><input value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} /></label>
            <label className="field full-span"><span>Correo</span><input value={profile?.email || ''} disabled /></label>
            <label className="field"><span>Zona horaria</span><select value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })}><option value="America/Santiago">Chile continental</option><option value="America/Punta_Arenas">Magallanes</option><option value="America/New_York">Nueva York</option><option value="Europe/Madrid">Madrid</option><option value="UTC">UTC</option></select></label>
            <label className="field"><span>Moneda</span><select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })}><option value="CLP">CLP</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="ARS">ARS</option><option value="BRL">BRL</option></select></label>
            <div className="form-actions full-span"><button className="button primary" disabled={saving}><Save size={17} /> {saving ? 'Guardando…' : 'Guardar perfil'}</button></div>
          </form>
        </article>

        <article className="panel-card">
          <div className="settings-section-title"><Moon size={21} /><div><h3>Apariencia</h3><p>Alterna entre modo claro y oscuro.</p></div></div>
          <div className="setting-row"><div><strong>Tema actual</strong><p>{theme === 'dark' ? 'Modo oscuro' : 'Modo claro'}</p></div><button className="button ghost" onClick={toggleTheme}>Cambiar tema</button></div>
        </article>

        <article className="panel-card full-settings-card">
          <div className="settings-section-title"><Download size={21} /><div><h3>Respaldo de datos</h3><p>Exporta todo en JSON o recupera una copia anterior.</p></div></div>
          <div className="backup-actions">
            <button className="button primary" onClick={() => void exportBackup()}><Download size={18} /> Exportar JSON</button>
            <div className="import-control"><select value={importMode} onChange={(event) => setImportMode(event.target.value as typeof importMode)}><option value="merge">Combinar con datos actuales</option><option value="replace">Reemplazar datos actuales</option></select><button className="button ghost" onClick={() => fileRef.current?.click()}><Upload size={18} /> Importar respaldo</button><input ref={fileRef} type="file" accept="application/json" hidden onChange={(event) => void importBackup(event)} /></div>
          </div>
          {importMode === 'replace' && <div className="form-alert error">El modo reemplazar elimina primero los datos actuales de tareas, compras, inventario, finanzas, memoria y conversación.</div>}
        </article>
      </section>
    </div>
  )
}
