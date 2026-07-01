import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { CheckCircle2, X, XCircle } from 'lucide-react'

type ToastKind = 'success' | 'error'
type Toast = { id: number; message: string; kind: ToastKind }

type ToastContextValue = {
  showToast: (message: string, kind?: ToastKind) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const remove = useCallback((id: number) => {
    setToasts((items) => items.filter((item) => item.id !== id))
  }, [])

  const showToast = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((items) => [...items, { id, message, kind }])
    window.setTimeout(() => remove(id), 3500)
  }, [remove])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.kind}`}>
            {toast.kind === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            <span>{toast.message}</span>
            <button className="icon-button" onClick={() => remove(toast.id)} aria-label="Cerrar">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast debe usarse dentro de ToastProvider.')
  return context
}
