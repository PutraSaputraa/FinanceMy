import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BarChart3, Bell, CalendarClock, CircleDollarSign, CreditCard, Goal, HandCoins, LayoutDashboard, LogOut, Menu, Moon, Plus, ReceiptText, Search, Settings, Sun, WalletCards, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useFinance } from '../../context/FinanceContext'
import { calculateCashFlow } from '../../utils/calculations'
import { getMonthInfo, getPeriodSummary } from '../../utils/analytics'
import { formatCurrency } from '../../utils/formatters'
import Toast from '../common/Toast'

const navigation = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Transaksi', path: '/transaksi', icon: ReceiptText },
  { label: 'Akun', path: '/akun', icon: WalletCards },
  { label: 'Budget', path: '/budget', icon: CircleDollarSign },
  { label: 'Transaksi Rutin', path: '/rutin', icon: CalendarClock },
  { label: 'Target Keuangan', path: '/target', icon: Goal },
  { label: 'Utang & Piutang', path: '/utang', icon: HandCoins },
  { label: 'Laporan', path: '/laporan', icon: BarChart3 },
  { label: 'Pengaturan', path: '/pengaturan', icon: Settings },
]

export default function AppLayout() {
  const [drawer, setDrawer] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { accounts, transactions, budgets, bills, toast } = useFinance()
  const navigate = useNavigate()
  const location = useLocation()
  const active = navigation.find((item) => location.pathname.startsWith(item.path))
  const doLogout = async () => { await logout(); navigate('/login') }
  const now = new Date()
  const month = getMonthInfo(now)
  const totalBalance = accounts.filter((account) => account.isActive).reduce((sum, account) => sum + Number(account.currentBalance || 0), 0)
  const currentExpense = getPeriodSummary(transactions, now).expense
  const dailyAverage = currentExpense / Math.max(month.daysElapsed, 1)
  const obligations = bills.filter((bill) => !['Sudah dibayar', 'Lunas', 'Dibatalkan'].includes(bill.status)).reduce((sum, bill) => sum + Number(bill.amount || 0), 0)
  const forecast = calculateCashFlow({ balance: totalBalance, obligations, dailyAverage, days: month.daysRemaining })
  const safeDays = dailyAverage ? Math.max(Math.floor((totalBalance - obligations) / dailyAverage), 0) : month.daysRemaining
  const snapshotProgress = totalBalance ? Math.max(Math.min((forecast.projectedBalance / totalBalance) * 100, 100), 0) : 0
  const notificationItems = [
    ...bills.filter((bill) => !['Sudah dibayar', 'Lunas', 'Dibatalkan'].includes(bill.status)).map((bill) => ({ tone: 'warning', title: `${bill.title || bill.name} belum dibayar`, detail: `${formatCurrency(bill.amount)} • ${bill.account || 'Akun belum dipilih'}` })),
    ...budgets.filter((budget) => budget.amount && (budget.spent / budget.amount) >= .8).map((budget) => ({ tone: (budget.spent / budget.amount) >= 1 ? 'danger' : 'warning', title: `Budget ${budget.name} terpakai ${Math.round((budget.spent / budget.amount) * 100)}%`, detail: `Tersisa ${formatCurrency(Math.max(budget.amount - budget.spent, 0))}` })),
    ...accounts.filter((account) => account.isActive && Number(account.currentBalance || 0) < 100000).map((account) => ({ tone: 'danger', title: `Saldo ${account.name} rendah`, detail: `Saldo saat ini ${formatCurrency(account.currentBalance)}` })),
  ].slice(0, 5)
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Pengguna'

  return <div className="app-shell">
    <aside className={`sidebar ${drawer ? 'open' : ''}`}>
      <div className="brand-row"><div className="brand-mark"><CreditCard size={22} /></div><span>Finance<span>My</span></span><button className="drawer-close" onClick={() => setDrawer(false)} aria-label="Tutup menu"><X /></button></div>
      <nav className="side-nav" aria-label="Navigasi utama">
        <p className="nav-caption">MENU UTAMA</p>
        {navigation.slice(0, 5).map(({ label, path, icon: Icon }) => <NavLink key={path} to={path} onClick={() => setDrawer(false)}><Icon size={19} /><span>{label}</span></NavLink>)}
        <p className="nav-caption">PERENCANAAN</p>
        {navigation.slice(5).map(({ label, path, icon: Icon }) => <NavLink key={path} to={path} onClick={() => setDrawer(false)}><Icon size={19} /><span>{label}</span></NavLink>)}
      </nav>
      <div className="cash-snapshot"><span>Proyeksi akhir bulan</span><strong>{formatCurrency(forecast.projectedBalance)}</strong><small>Estimasi, bukan nilai pasti</small><div className="mini-track"><i style={{width:`${snapshotProgress}%`}} /></div><p>{forecast.projectedBalance >= 0 ? `Aman untuk sekitar ${Math.min(safeDays, month.daysRemaining)} hari ke depan` : 'Perlu perhatian pada pengeluaran mendatang'}</p></div>
      <button className="user-menu" onClick={doLogout} title="Keluar dari akun">
        <span className="user-initial">{displayName.charAt(0).toUpperCase()}</span><span><strong>{displayName}</strong><small>{user?.email}</small></span><LogOut size={17} />
      </button>
    </aside>
    {drawer && <button className="drawer-scrim" onClick={() => setDrawer(false)} aria-label="Tutup menu" />}
    <main className="main-shell">
      <header className="topbar">
        <div className="mobile-brand"><button className="icon-btn" onClick={() => setDrawer(true)} aria-label="Buka menu"><Menu /></button><strong>{active?.label || 'FinanceMy'}</strong></div>
        <label className="search-box"><Search size={18} /><input aria-label="Cari" placeholder="Cari transaksi, akun, atau budget..." /><kbd>⌘ K</kbd></label>
        <div className="top-actions">
          <button className="icon-btn" onClick={toggleTheme} aria-label="Ganti tema">{theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}</button>
          <div className="notification-wrap"><button className="icon-btn notification-btn" onClick={() => setNotificationOpen(!notificationOpen)} aria-label="Notifikasi"><Bell size={19} />{notificationItems.length > 0 && <i>{notificationItems.length}</i>}</button>
            {notificationOpen && <div className="notification-popover"><div><strong>Notifikasi</strong></div>{notificationItems.length ? notificationItems.map((item, index)=><p key={`${item.title}-${index}`}><span className={`notif-dot ${item.tone}`} />{item.title}<small>{item.detail}</small></p>) : <p>Belum ada notifikasi<small>Semua kondisi keuanganmu akan dipantau di sini.</small></p>}</div>}
          </div>
          <button className="primary-btn top-add" onClick={() => navigate('/transaksi?add=true')}><Plus size={18} /> Tambah transaksi</button>
        </div>
      </header>
      <div className="page-content"><Outlet /></div>
      <nav className="mobile-nav" aria-label="Navigasi mobile">
        {navigation.slice(0, 4).map(({ label, path, icon: Icon }) => <NavLink key={path} to={path}><Icon size={20} /><span>{label}</span></NavLink>)}
        <button onClick={() => setDrawer(true)}><Menu size={20} /><span>Lainnya</span></button>
      </nav>
    </main>
    <Toast toast={toast} />
  </div>
}
