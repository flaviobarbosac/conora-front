import { Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import { lazy, useEffect, useState } from 'react'
import { familyApi } from './api/finance'
import { listenNativeShare } from './share/receiveShare'
import { listenAppLinks } from './lib/appLinks'
import { useAuth } from './auth/AuthProvider'
import { isConsoleOperator } from './auth/consoleAccess'
import { ConfirmDialogHost } from './components/ConfirmDialog'
import { SaveToastHost } from './components/SaveToast'
import { Splash } from './components/Splash'
import { RequirePlanAccess } from './components/PlanAccessGate'
import { UnsavedChangesProvider } from './hooks/useUnsavedChanges'
import { AppShell } from './layouts/AppShell'
import { AdminPage } from './pages/AdminPage'
import { ConsolePage } from './pages/ConsolePage'
import { ApresentacaoPage } from './pages/ApresentacaoPage'
import { ApresentacaoVariantesPage } from './pages/apresentacao/ApresentacaoVariantesPage'
import { DiagnosisPage } from './pages/DiagnosisPage'
import { HelpPage } from './pages/HelpPage'
import { HomePage } from './pages/HomePage'
import { ImportPage } from './pages/ImportPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { LoginPage } from './pages/LoginPage'
import { MembersPage } from './pages/MembersPage'
import { JornadaRaioXPage } from './pages/JornadaRaioXPage'
import { MarcosPage } from './pages/MarcosPage'
import { MonthPage } from './pages/MonthPage'
import { MorePage } from './pages/MorePage'
import { OnboardingPage } from './pages/OnboardingPage'
import { OwnerTransferPage } from './pages/OwnerTransferPage'
import { PatrimonyPage } from './pages/PatrimonyPage'
import { ContractPage } from './pages/ContractPage'
import { PlanPage } from './pages/PlanPage'
import { ProfilePage } from './pages/ProfilePage'
import { ProjectDetailPage } from './pages/ProjectDetailPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { RegisterPage } from './pages/RegisterPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { VerifyEmailPage } from './pages/VerifyEmailPage'
import { WelcomePage } from './pages/WelcomePage'
import { RetrospectivePage } from './pages/RetrospectivePage'
import { SettingsPage } from './pages/SettingsPage'
import { ShareTargetPage } from './pages/ShareTargetPage'
import { WhatsAppPage } from './pages/WhatsAppPage'
import { GroupInvitePage } from './pages/GroupInvitePage'

const AccountsPage = lazy(() =>
  import('./pages/AccountsPage').then((m) => ({ default: m.AccountsPage })),
)
const BudgetPage = lazy(() =>
  import('./pages/BudgetPage').then((m) => ({ default: m.BudgetPage })),
)
const CategoriesPage = lazy(() =>
  import('./pages/CategoriesPage').then((m) => ({ default: m.CategoriesPage })),
)
const EntriesPage = lazy(() =>
  import('./pages/EntriesPage').then((m) => ({ default: m.EntriesPage })),
)
const RaioXPage = lazy(() =>
  import('./pages/RaioXPage').then((m) => ({ default: m.RaioXPage })),
)

function RequireAuth() {
  const { session, authReady } = useAuth()
  if (!authReady) {
    return null
  }
  if (!session) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}

function RequireConsole() {
  const { session } = useAuth()
  if (!isConsoleOperator(session?.email)) {
    return <Navigate to="/" replace />
  }
  return <ConsolePage />
}

function RequireOnboarding() {
  const { session } = useAuth()
  const [ready, setReady] = useState(false)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function check() {
      if (!session) {
        setReady(true)
        return
      }
      try {
        const profile = await familyApi.profile()
        if (!cancelled) {
          setNeedsOnboarding(!profile.onboardingCompleted)
          setReady(true)
        }
      } catch {
        if (!cancelled) {
          setReady(true)
        }
      }
    }
    void check()
    function onChanged() {
      void check()
    }
    window.addEventListener('conora:profile-changed', onChanged)
    return () => {
      cancelled = true
      window.removeEventListener('conora:profile-changed', onChanged)
    }
  }, [session])

  if (!ready) {
    return null
  }
  if (needsOnboarding) {
    return <Navigate to="/onboarding" replace />
  }
  return <Outlet />
}

export default function App() {
  const [splashDone, setSplashDone] = useState(false)
  const navigate = useNavigate()

  useEffect(() => listenNativeShare(() => navigate('/compartilhar')), [navigate])
  useEffect(() => listenAppLinks((route) => navigate(route)), [navigate])

  return (
    <UnsavedChangesProvider>
      {splashDone ? null : <Splash onFinished={() => setSplashDone(true)} />}
      <ConfirmDialogHost />
      <SaveToastHost />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/recuperar-senha" element={<ForgotPasswordPage />} />
        <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
        <Route path="/validar-email" element={<VerifyEmailPage />} />
        <Route path="/bem-vindo" element={<WelcomePage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/apresentacao" element={<ApresentacaoPage />} />
        <Route path="/apresentacao/:variante" element={<ApresentacaoVariantesPage />} />
        <Route path="/compartilhar" element={<ShareTargetPage />} />
        <Route path="/grupo/convite/:token" element={<GroupInvitePage />} />
        <Route path="/grupo/bem-vindo" element={<Navigate to="/membros" replace />} />
        <Route element={<RequireAuth />}>
          <Route path="/grupo/owner/:token" element={<OwnerTransferPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route element={<RequireOnboarding />}>
            <Route element={<RequirePlanAccess />}>
              <Route element={<AppShell />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/lancamentos" element={<EntriesPage />} />
                <Route path="/raio-x" element={<RaioXPage />} />
                <Route path="/orcamento" element={<BudgetPage />} />
                <Route path="/contas" element={<AccountsPage />} />
                <Route path="/cartoes" element={<AccountsPage />} />
                <Route path="/projetos" element={<ProjectsPage />} />
                <Route path="/projetos/:id" element={<ProjectDetailPage />} />
                <Route path="/relatorios" element={<MorePage />} />
                <Route path="/jornada" element={<JornadaRaioXPage />} />
                <Route path="/marcos" element={<MarcosPage />} />
                <Route path="/retrospectiva" element={<RetrospectivePage />} />
                <Route path="/diagnostico" element={<DiagnosisPage />} />
                <Route path="/categorias" element={<CategoriesPage />} />
                <Route path="/plano-de-contas" element={<Navigate to="/categorias" replace />} />
                <Route path="/patrimonio" element={<PatrimonyPage />} />
                <Route path="/membros" element={<MembersPage />} />
                <Route path="/plano" element={<PlanPage />} />
                <Route path="/plano/contrato" element={<ContractPage />} />
                <Route path="/operacao" element={<AdminPage />} />
                <Route path="/ajuda" element={<HelpPage />} />
                <Route path="/perfil" element={<ProfilePage />} />
                <Route path="/configuracoes" element={<SettingsPage />} />
                <Route path="/console" element={<RequireConsole />} />
                <Route path="/whatsapp" element={<WhatsAppPage />} />
                <Route path="/importar" element={<ImportPage />} />
                <Route path="/mes" element={<MonthPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Route>
          </Route>
        </Route>
      </Routes>
    </UnsavedChangesProvider>
  )
}
