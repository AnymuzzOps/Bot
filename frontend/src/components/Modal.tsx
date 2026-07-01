import { X } from 'lucide-react'

export function Modal({
  open,
  title,
  children,
  onClose,
  size = 'medium',
}: {
  open: boolean
  title: string
  children: React.ReactNode
  onClose: () => void
  size?: 'small' | 'medium' | 'large'
}) {
  if (!open) return null
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
