import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from './auth/AuthProvider'
import { Splash } from './components/Splash'
import { AppShell } from './layouts/AppShell'
import { AccountsPage } from './pages/AccountsPage'
import { AiPage } from './pages/AiPage'
import { BudgetPage } from './pages/BudgetPage'
import { CategoriesPage } from './pages/CategoriesPage'
import { DiagnosisPage } from './pages/DiagnosisPage'
import { EntriesPage } from './pages/EntriesPage'
import { HelpPage } from './pages/HelpPage'
import { HomePage } from './pages/HomePage'
import { ImportPage } from './pages/ImportPage'
import { LoginPage } from './pages/LoginPage'
import { MembersPage } from './pages/MembersPage'
import { MonthPage } from './pages/MonthPage'
import { MorePage } from './pages/MorePage'
import { PatrimonyPage } from './pages/PatrimonyPage'
import { PlanPage } from './pages/PlanPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { RegisterPage } from './pages/RegisterPage'
import { WhatsAppPage } from './pages/WhatsAppPage'

function RequireAuth() {
  const { session } = useAuth()
  if (!session) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}

export default function App() {
  const [splashDone, setSplashDone] = useState(false)

  return (
    <>
      {splashDone ? null : <Splash onFinished={() => setSplashDone(true)} />}
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/lancamentos" element={<EntriesPage />} />
            <Route path="/orcamento" element={<BudgetPage />} />
            <Route path="/contas" element={<AccountsPage />} />
            <Route path="/projetos" element={<ProjectsPage />} />
            <Route path="/relatorios" element={<MorePage />} />
            <Route path="/diagnostico" element={<DiagnosisPage />} />
            <Route path="/categorias" element={<CategoriesPage />} />
            <Route path="/patrimonio" element={<PatrimonyPage />} />
            <Route path="/membros" element={<MembersPage />} />
            <Route path="/plano" element={<PlanPage />} />
            <Route path="/ajuda" element={<HelpPage />} />
            <Route path="/ia" element={<AiPage />} />
            <Route path="/whatsapp" element={<WhatsAppPage />} />
            <Route path="/importar" element={<ImportPage />} />
            <Route path="/mes" element={<MonthPage />} />
          </Route>
        </Route>
      </Routes>
    </>
  )
}
