import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BarChart3, Bell, CalendarClock, CircleDollarSign, CreditCard, Goal, HandCoins, LayoutDashboard, LogOut, Menu, Moon, Plus, ReceiptText, Search, Settings, Sun, WalletCards, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useFinance } from '../../context/FinanceContext'
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
  const [notifications, setNotifications] = useState(false)
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { toast } = useFinance()
  const navigate = useNavigate()
  const location = useLocation()
  const active = navigation.find((item) => location.pathname.startsWith(item.path))
  const doLogout = async () => { await logout(); navigate('/login') }

  return <div className="app-shell">
    <aside className={`sidebar ${drawer ? 'open' : ''}`}>
      <div className="brand-row"><div className="brand-mark"><CreditCard size={22} /></div><span>Finance<span>My</span></span><button className="drawer-close" onClick={() => setDrawer(false)} aria-label="Tutup menu"><X /></button></div>
      <nav className="side-nav" aria-label="Navigasi utama">
        <p className="nav-caption">MENU UTAMA</p>
        {navigation.slice(0, 5).map(({ label, path, icon: Icon }) => <NavLink key={path} to={path} onClick={() => setDrawer(false)}><Icon size={19} /><span>{label}</span></NavLink>)}
        <p className="nav-caption">PERENCANAAN</p>
        {navigation.slice(5).map(({ label, path, icon: Icon }) => <NavLink key={path} to={path} onClick={() => setDrawer(false)}><Icon size={19} /><span>{label}</span></NavLink>)}
      </nav>
      <div className="cash-snapshot"><span>Saldo hingga gajian</span><strong>Rp6.248.000</strong><small>Estimasi, bukan nilai pasti</small><div className="mini-track"><i /></div><p>Aman untuk 19 hari ke depan</p></div>
      <button className="user-menu" onClick={doLogout} title="Keluar dari akun">
        <span className="user-initial">{user?.displayName?.charAt(0) || 'R'}</span><span><strong>{user?.displayName || 'Raka Pratama'}</strong><small>{user?.email}</small></span><LogOut size={17} />
      </button>
    </aside>
    {drawer && <button className="drawer-scrim" onClick={() => setDrawer(false)} aria-label="Tutup menu" />}
    <main className="main-shell">
      <header className="topbar">
        <div className="mobile-brand"><button className="icon-btn" onClick={() => setDrawer(true)} aria-label="Buka menu"><Menu /></button><strong>{active?.label || 'FinanceMy'}</strong></div>
        <label className="search-box"><Search size={18} /><input aria-label="Cari" placeholder="Cari transaksi, akun, atau budget..." /><kbd>⌘ K</kbd></label>
        <div className="top-actions">
          <button className="icon-btn" onClick={toggleTheme} aria-label="Ganti tema">{theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}</button>
          <div className="notification-wrap"><button className="icon-btn notification-btn" onClick={() => setNotifications(!notifications)} aria-label="Notifikasi"><Bell size={19} /><i>3</i></button>
            {notifications && <div className="notification-popover"><div><strong>Notifikasi</strong><button>Tandai dibaca</button></div><p><span className="notif-dot warning" />WiFi jatuh tempo dalam 3 hari<small>Nominal Rp350.000 • BSI</small></p><p><span className="notif-dot danger" />Budget transportasi terpakai 87%<small>Tersisa Rp97.500 bulan ini</small></p><p><span className="notif-dot success" />Target dana darurat bertambah<small>Progress saat ini 42%</small></p></div>}
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
