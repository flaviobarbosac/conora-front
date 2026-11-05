import { useEffect, useMemo } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { planApi } from '../api/finance'
import { useAuth } from '../auth/AuthProvider'
import { isConsoleOperator } from '../auth/consoleAccess'
import { useLoad } from '../hooks/useLoad'
import { PlanAccessContext } from '../hooks/usePlanAccess'
import { graceScreenShown, PLAN_CHANGED } from '../lib/planAccess'

const PLANS_PATH = '/plano'
const SETTINGS_PATH = '/configuracoes'

function exportWindowOpen(until: string | null | undefined): boolean {
  if (!until) return false
  const end = new Date(until).getTime()
  return Number.isFinite(end) && end > Date.now()
}

function isPlansScreen(pathname: string) {
  return pathname === PLANS_PATH || pathname.startsWith(`${PLANS_PATH}/`)
}

/**
 * Applies the access lifecycle: Blocked accounts only open the plans screen.
 * After the student trial the product stays on free-tier limits (Expired), not app-wide lock.
 * Grace (legacy) still opens the plans screen once per session.
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
  const exportOnly = exportWindowOpen(plan.data?.exportOnlyUntil)
  const consoleOpen =
    (pathname === '/console' || pathname.startsWith('/console/')) &&
    isConsoleOperator(session?.email)
  if (exportOnly && pathname !== SETTINGS_PATH && !consoleOpen) {
    return <Navigate to={SETTINGS_PATH} replace />
  }
  if (!exportOnly && !isPlansScreen(pathname) && !consoleOpen) {
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
