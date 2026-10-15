import { useEffect, useMemo } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { planApi } from '../api/finance'
import { useAuth } from '../auth/AuthProvider'
import { isConsoleOperator } from '../auth/consoleAccess'
import { useLoad } from '../hooks/useLoad'
import { PlanAccessContext } from '../hooks/usePlanAccess'
import { graceScreenShown, PLAN_CHANGED } from '../lib/planAccess'

const PLANS_PATH = '/plano'

/**
 * Applies the access lifecycle: after day 100 without a plan only the plans screen opens;
 * between days 90 and 100 the plans screen is shown once per app session (read-only access).
 */
export function RequirePlanAccess() {
  const plan = useLoad(() => planApi.get(), [])
  const { pathname } = useLocation()
  const { session } = useAuth()
  const { reload } = plan

  useEffect(() => {
    window.addEventListener(PLAN_CHANGED, reload)
    return () => window.removeEventListener(PLAN_CHANGED, reload)
  }, [reload])

  const value = useMemo(() => ({ plan: plan.data, reload }), [plan.data, reload])

  if (plan.loading && !plan.data && !plan.error) {
    return null
  }
  const phase = plan.data?.phase
  const consoleOpen = pathname === '/console' && isConsoleOperator(session?.email)
  if (pathname !== PLANS_PATH && !consoleOpen) {
    if (phase === 'Blocked') {
      return <Navigate to={PLANS_PATH} replace />
    }
    if (phase === 'Grace' && !graceScreenShown()) {
      return <Navigate to={PLANS_PATH} replace />
    }
  }
  return (
    <PlanAccessContext.Provider value={value}>
      <Outlet />
    </PlanAccessContext.Provider>
  )
}
