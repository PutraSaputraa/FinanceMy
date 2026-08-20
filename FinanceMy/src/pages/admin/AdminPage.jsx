import { useCallback, useEffect, useMemo, useState } from 'react'
import { Archive, KeyRound, LoaderCircle, LogOut, Plus, RotateCcw, ShieldCheck, UserRound, UsersRound } from 'lucide-react'
import Modal from '../../components/common/Modal'
import { useAuth } from '../../context/AuthContext'
import { createAdminUser, listAdminUsers, sendAdminPasswordReset, setAdminUserStatus } from '../../services/adminService'

const dateLabel = (value) => value ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(value)) : '–'

export default function AdminPage() {
  const { user, loading: authLoading, login, logout, resetPassword: sendPasswordEmail } = useAuth()
  const [authorized, setAuthorized] = useState(false)
  const [checking, setChecking] = useState(true)
  const [users, setUsers] = useState([])
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [target, setTarget] = useState(null)

  const verifyAdmin = useCallback(async (currentUser) => {
    if (!currentUser || currentUser.isDemo) { setAuthorized(false); setChecking(false); return false }
    const token = await currentUser.getIdTokenResult(true)
    if (token.claims.admin !== true) {
      await logout()
      setAuthorized(false)
      setFeedback({ tone: 'error', text: 'Akun ini tidak memiliki akses admin.' })
      setChecking(false)
      return false
    }
    setAuthorized(true)
    setChecking(false)
    return true
  }, [logout])

  const loadUsers = useCallback(async () => {
    setBusy(true)
    try { const result = await listAdminUsers(); setUsers(result.users || []) }
    catch (error) { setFeedback({ tone: 'error', text: error.message }) }
    finally { setBusy(false) }
  }, [])

  useEffect(() => {
    if (authLoading) return
    let active = true
    queueMicrotask(() => {
      if (!active) return
      verifyAdmin(user).then((valid) => { if (active && valid) loadUsers() }).catch(async () => {
        await logout()
        if (!active) return
        setChecking(false)
        setFeedback({ tone: 'error', text: 'Sesi admin tidak dapat diverifikasi.' })
      })
    })
    return () => { active = false }
  }, [authLoading, loadUsers, logout, user, verifyAdmin])

  const submitLogin = async (event) => {
    event.preventDefault(); setBusy(true); setFeedback(null)
    const data = new FormData(event.currentTarget)
    try {
      const result = await login(data.get('email'), data.get('password'))
      if (await verifyAdmin(result.user)) await loadUsers()
    } catch { setFeedback({ tone: 'error', text: 'Email atau password admin tidak sesuai.' }) }
    finally { setBusy(false) }
  }

  const createUser = async (event) => {
    event.preventDefault(); setBusy(true); setFeedback(null)
    const form = event.currentTarget
    const data = new FormData(form)
    try {
      const result = await createAdminUser({ username: data.get('username'), email: data.get('email'), password: data.get('password') })
      form.reset()
      setFeedback({ tone: 'success', text: result.message })
      await loadUsers()
    } catch (error) { setFeedback({ tone: 'error', text: error.message }) }
    finally { setBusy(false) }
  }

  const updateStatus = async () => {
    if (!target) return
    setBusy(true)
    try {
      const next = target.status === 'active' ? 'disabled' : 'active'
      const result = await setAdminUserStatus(target.uid, next)
      setFeedback({ tone: 'success', text: result.message }); setTarget(null); await loadUsers()
    } catch (error) { setFeedback({ tone: 'error', text: error.message }) }
    finally { setBusy(false) }
  }

  const resetPassword = async (account) => {
    setBusy(true); setFeedback(null)
    try { const result = await sendAdminPasswordReset(account.uid); await sendPasswordEmail(result.email); setFeedback({ tone: 'success', text: 'Email reset password telah dikirim.' }) }
    catch (error) { setFeedback({ tone: 'error', text: error.message }) }
    finally { setBusy(false) }
  }

  const counts = useMemo(() => ({ active: users.filter((item) => item.status === 'active').length, disabled: users.filter((item) => item.status === 'disabled').length }), [users])

  if (authLoading || checking) return <main className="admin-auth"><div className="admin-loader"><LoaderCircle className="spin"/><span>Memverifikasi akses admin...</span></div></main>
  if (!authorized) return <main className="admin-auth"><section className="admin-login card"><div className="admin-mark"><ShieldCheck/></div><span className="reference-form-eyebrow">ADMIN FINANCEMY</span><h1>Masuk sebagai admin</h1><p>Kelola akses pengguna FinanceMy melalui akun admin terverifikasi.</p>{feedback&&<div className={`admin-feedback ${feedback.tone}`}>{feedback.text}</div>}<form onSubmit={submitLogin}><label>Email admin<input name="email" type="email" required autoComplete="email"/></label><label>Password<input name="password" type="password" required autoComplete="current-password"/></label><button className="primary-btn" disabled={busy}>{busy?<LoaderCircle className="spin"/>:<ShieldCheck/>}{busy?'Memverifikasi...':'Masuk ke admin'}</button></form><a href="/login">Kembali ke login pengguna</a></section></main>

  return <main className="admin-page"><header className="admin-header"><div><span className="admin-brand"><ShieldCheck/>FinanceMy Admin</span><small>Manajemen akses pengguna</small></div><button className="secondary-btn" onClick={logout}><LogOut/>Logout</button></header><div className="admin-content">
    {feedback&&<div className={`admin-feedback ${feedback.tone}`}>{feedback.text}<button onClick={()=>setFeedback(null)}>×</button></div>}
    <section className="admin-metrics"><article className="card"><UsersRound/><span>Semua pengguna<strong>{users.length}</strong></span></article><article className="card"><UserRound/><span>Pengguna aktif<strong>{counts.active}</strong></span></article><article className="card"><Archive/><span>Nonaktif<strong>{counts.disabled}</strong></span></article></section>
    <section className="admin-grid"><form className="card admin-create" onSubmit={createUser}><header><Plus/><span><strong>Tambah pengguna</strong><small>Akun langsung aktif tanpa pengaturan password melalui email.</small></span></header><label>Email<input name="email" type="email" required autoComplete="off"/></label><label>Username<input name="username" required minLength="2" maxLength="60" autoComplete="off"/></label><label>Password awal<input name="password" type="password" required minLength="8" maxLength="128" autoComplete="new-password"/></label><small className="admin-password-hint">Minimal 8 karakter. Berikan email dan password awal kepada pengguna melalui jalur yang aman.</small><button className="primary-btn" disabled={busy}><Plus/>{busy?'Memproses...':'Buat akun'}</button></form>
    <section className="card admin-users"><header><div><h2>Daftar pengguna</h2><p>{users.length} akun terdaftar</p></div>{busy&&<LoaderCircle className="spin"/>}</header>{users.length?<div className="admin-table-wrap"><table><thead><tr><th>Pengguna</th><th>Dibuat</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{users.map((account)=><tr key={account.uid}><td><strong>{account.name||'Tanpa nama'}{account.isAdmin&&<em>Admin</em>}</strong><small>{account.email}</small></td><td>{dateLabel(account.createdAt)}</td><td><span className={`admin-status ${account.status}`}>{account.status==='active'?'Aktif':'Nonaktif'}</span></td><td><div className="admin-actions"><button title="Kirim reset password" disabled={busy||account.status==='disabled'} onClick={()=>resetPassword(account)}><KeyRound/></button><button title={account.status==='active'?'Nonaktifkan':'Aktifkan'} disabled={busy||account.isAdmin} onClick={()=>setTarget(account)}>{account.status==='active'?<Archive/>:<RotateCcw/>}</button></div></td></tr>)}</tbody></table></div>:<div className="empty-state"><UsersRound/><h3>Belum ada pengguna</h3><p>Buat pengguna pertama melalui formulir di samping.</p></div>}</section></section>
  </div><Modal open={!!target} onClose={()=>setTarget(null)} title={`${target?.status==='active'?'Nonaktifkan':'Aktifkan'} ${target?.name||'pengguna'}?`} description={target?.status==='active'?'Pengguna akan segera kehilangan akses ke data FinanceMy.':'Pengguna dapat kembali login dan mengakses datanya.'}><div className="form-actions"><button className="secondary-btn" onClick={()=>setTarget(null)}>Batal</button><button className={target?.status==='active'?'danger-btn':'primary-btn'} disabled={busy} onClick={updateStatus}>{target?.status==='active'?<Archive/>:<RotateCcw/>}{target?.status==='active'?'Nonaktifkan':'Aktifkan kembali'}</button></div></Modal></main>
}
