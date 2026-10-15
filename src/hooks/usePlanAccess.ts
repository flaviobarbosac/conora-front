import { createContext, useContext } from 'react'
import type { Plan } from '../api/finance'

export type PlanAccess = { plan: Plan | null; reload: () => void }

export const PlanAccessContext = createContext<PlanAccess>({ plan: null, reload: () => {} })

/** Plan/access state loaded by the access gate around the app shell. */
export function usePlanAccess(): PlanAccess {
  return useContext(PlanAccessContext)
}
