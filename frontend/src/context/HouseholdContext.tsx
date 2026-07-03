import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { apiData } from '../lib/api'
import { useAuth } from './AuthContext'
import type { HouseholdMe } from '../lib/types'

type HouseholdContextValue = {
  household: HouseholdMe['household'] | null
  member: HouseholdMe['member'] | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const HouseholdContext = createContext<HouseholdContextValue | undefined>(undefined)

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [state, setState] = useState<HouseholdMe | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    if (!user) {
      setState(null)
      setError(null)
      return
    }
    setLoading(true)
    try {
      setState(await apiData<HouseholdMe>('/api/household/me'))
      setError(null)
    } catch (caught) {
      setState(null)
      setError(caught instanceof Error ? caught.message : 'No fue posible cargar el hogar compartido.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [user?.id])

  const value = useMemo<HouseholdContextValue>(() => ({
    household: state?.household || null,
    member: state?.member || null,
    loading,
    error,
    refresh,
  }), [state, loading, error])

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>
}

export const useHousehold = () => {
  const context = useContext(HouseholdContext)
  if (!context) throw new Error('useHousehold debe usarse dentro de HouseholdProvider')
  return context
}
