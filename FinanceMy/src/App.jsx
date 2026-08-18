import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import AppLayout from './components/layout/AppLayout'
import './App.css'

const AuthPage = lazy(() => import('./pages/auth/AuthPage'))
const OnboardingPage = lazy(() => import('./pages/auth/OnboardingPage'))
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'))
const TransactionsPage = lazy(() => import('./pages/transactions/TransactionsPage'))
const AccountsPage = lazy(() => import('./pages/accounts/AccountsPage'))
const BudgetsPage = lazy(() => import('./pages/budgets/BudgetsPage'))
const RecurringPage = lazy(() => import('./pages/recurring/RecurringPage'))
const GoalsPage = lazy(() => import('./pages/goals/GoalsPage'))
const DebtsPage = lazy(() => import('./pages/debts/DebtsPage'))
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'))
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'))
const AdminPage = lazy(() => import('./pages/admin/AdminPage'))

function LoadingScreen() { return <div className="loading-screen"><div className="brand-loader">FM</div><span>Menyiapkan FinanceMy...</span></div> }
function Protected({ children }) { const { user, loading } = useAuth(); if (loading) return <LoadingScreen/>; return user ? children : <Navigate to="/login" replace/> }

export default function App() {
  return <Suspense fallback={<LoadingScreen/>}><Routes>
    <Route path="/login" element={<AuthPage mode="login"/>}/>
    <Route path="/register" element={<Navigate to="/login" replace/>}/>
    <Route path="/lupa-password" element={<AuthPage mode="forgot"/>}/>
    <Route path="/admin" element={<AdminPage/>}/>
    <Route path="/onboarding" element={<Protected><OnboardingPage/></Protected>}/>
    <Route element={<Protected><AppLayout/></Protected>}>
      <Route path="/dashboard" element={<DashboardPage/>}/>
      <Route path="/transaksi" element={<TransactionsPage/>}/>
      <Route path="/akun" element={<AccountsPage/>}/>
      <Route path="/budget" element={<BudgetsPage/>}/>
      <Route path="/rutin" element={<RecurringPage/>}/>
      <Route path="/target" element={<GoalsPage/>}/>
      <Route path="/utang" element={<DebtsPage/>}/>
      <Route path="/laporan" element={<ReportsPage/>}/>
      <Route path="/pengaturan" element={<SettingsPage/>}/>
    </Route>
    <Route path="*" element={<Navigate to="/dashboard" replace/>}/>
  </Routes></Suspense>
}
