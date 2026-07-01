import { FormEvent, useEffect, useRef, useState } from 'react'
import { Bot, Send, Sparkles, Trash2, UserRound } from 'lucide-react'
import { api, apiData } from '../lib/api'
import type { Conversation } from '../lib/types'
import { formatDate } from '../lib/format'
import { useToast } from '../context/ToastContext'
import { Loading } from '../components/Loading'

const suggestions = [
  'Agrega estudiar inglés mañana a las 18:00.',
  'Necesito 3 litros de leche en la lista de compras.',
  'Gasté 25.000 en supermercado hoy.',
  '¿Qué alimentos vencen pronto?',
]

export function ChatPage() {
  const [messages, setMessages] = useState<Conversation[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const { showToast } = useToast()

  const load = async () => {
    try {
      setMessages(await apiData<Conversation[]>('/api/conversations?limit=100'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, sending])

  const send = async (event?: FormEvent, preset?: string) => {
    event?.preventDefault()
    const content = (preset ?? input).trim()
    if (!content || sending) return

    const optimistic: Conversation = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    }
    setMessages((current) => [...current, optimistic])
    setInput('')
    setSending(true)

    try {
      const response = await api<{ data: { message: Conversation; executed_tools: string[] } }>('/api/chat', {
        method: 'POST',
        body: { message: content },
      })
      setMessages((current) => [...current.filter((item) => item.id !== optimistic.id), optimistic, response.data.message])
    } catch (caught) {
      setMessages((current) => current.filter((item) => item.id !== optimistic.id))
      showToast(caught instanceof Error ? caught.message : 'No fue posible enviar el mensaje.', 'error')
    } finally {
      setSending(false)
    }
  }

  const clear = async () => {
    if (!window.confirm('¿Eliminar todo el historial de conversación?')) return
    await api('/api/conversations', { method: 'DELETE' })
    setMessages([])
    showToast('Historial eliminado.')
  }

  if (loading) return <Loading label="Cargando conversación…" />

  return (
    <div className="chat-layout">
      <section className="chat-card">
        <div className="chat-toolbar">
          <div><span className="status-dot" /> <strong>Asistente conectado</strong><p>Puede conversar y administrar tus datos.</p></div>
          <button className="button ghost" onClick={clear}><Trash2 size={17} /> Limpiar</button>
        </div>

        <div className="chat-messages">
          {!messages.length && (
            <div className="chat-empty">
              <div className="assistant-orb"><Sparkles size={30} /></div>
              <h2>¿En qué te ayudo hoy?</h2>
              <p>Escribe de forma natural. Puedo crear tareas, registrar gastos y recordar información importante.</p>
              <div className="suggestion-grid">
                {suggestions.map((suggestion) => <button key={suggestion} onClick={() => void send(undefined, suggestion)}>{suggestion}</button>)}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <article className={`message ${message.role}`} key={message.id}>
              <div className="message-avatar">{message.role === 'assistant' ? <Bot size={19} /> : <UserRound size={19} />}</div>
              <div className="message-bubble">
                <p>{message.content}</p>
                <time>{formatDate(message.created_at, true)}</time>
              </div>
            </article>
          ))}

          {sending && (
            <article className="message assistant">
              <div className="message-avatar"><Bot size={19} /></div>
              <div className="message-bubble typing"><span /><span /><span /></div>
            </article>
          )}
          <div ref={bottomRef} />
        </div>

        <form className="chat-composer" onSubmit={(event) => void send(event)}>
          <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void send()
            }
          }} placeholder="Escribe una pregunta o instrucción…" rows={1} />
          <button className="send-button" disabled={!input.trim() || sending} aria-label="Enviar"><Send size={20} /></button>
        </form>
      </section>
    </div>
  )
}
