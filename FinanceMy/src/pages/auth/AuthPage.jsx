import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Sparkles } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import brandLogo from '../../assets/financemy-logo-mark.png'
import heroVisual from '../../assets/financemy-hero-3d.png'
import './auth.css'

const messages = {
  'auth/invalid-credential': 'Email atau password tidak sesuai.',
  'auth/email-already-in-use': 'Email ini sudah terdaftar. Silakan masuk.',
  'auth/too-many-requests': 'Terlalu banyak percobaan. Coba lagi beberapa saat.',
  'auth/network-request-failed': 'Koneksi terputus. Periksa internet lalu coba lagi.',
}

export default function AuthPage({ mode = 'login' }) {
  const [showPassword, setShowPassword] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [busy, setBusy] = useState(false)
  const { login, resetPassword, demoLogin } = useAuth()
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors } } = useForm()

  const submit = async (values) => {
    if (busy) return
    setBusy(true)
    setFeedback(null)
    try {
      if (mode === 'forgot') {
        await resetPassword(values.email)
        setFeedback({ tone: 'success', text: 'Tautan reset password sudah dikirim. Periksa email Anda.' })
        setBusy(false)
      } else {
        await login(values.email, values.password)
        navigate('/dashboard', { replace: true })
      }
    } catch (error) {
      setFeedback({ tone: 'error', text: messages[error.code] || 'Terjadi kesalahan. Periksa data dan coba lagi.' })
      setBusy(false)
    }
  }

  const enterDemo = async () => {
    if (busy) return
    setBusy(true)
    try {
      await demoLogin()
      navigate('/dashboard', { replace: true })
    } catch {
      setFeedback({ tone: 'error', text: 'Demo belum dapat dibuka. Coba lagi.' })
      setBusy(false)
    }
  }
  const isLogin = mode === 'login'
  const title = isLogin ? 'Masuk ke akunmu' : 'Atur ulang password'
  const subtitle = isLogin ? 'Lanjutkan progres keuanganmu hari ini.' : 'Kami akan mengirim tautan pemulihan ke emailmu.'

  return <main className={`auth-reference-page${isLogin ? '' : ' auth-recovery-page'}`}>
    <section className="auth-reference-visual">
      <Link className="auth-brand" to="/" aria-label="FinanceMy beranda"><span><img src={brandLogo} alt="" aria-hidden="true"/></span><div>Finance<b>My</b></div></Link>
      <div className="auth-copy">
        <span className="auth-kicker"><Sparkles size={15}/> Keuangan jadi lebih jelas</span>
        <h1>Tenang dengan uang.<br/><em>Yakin dengan rencana.</em></h1>
        <p>Kelola uangmu, pahami kebiasaanmu, dan rencanakan masa depanmu.</p>
        <div className="auth-benefits">
          <span><Check/>Semua saldo dalam satu pandangan</span>
          <span><Check/>Budget yang menyesuaikan kebiasaanmu</span>
          <span><Check/>Privasi data terlindungi Firebase</span>
        </div>
        <div className="auth-proof-card"><ShieldCheck/>Akun pribadi dengan data yang terpisah dan terlindungi.</div>
      </div>
      <img className="auth-product-art" src={heroVisual} alt="" aria-hidden="true"/>
      <div className="auth-quote"><div className="quote-icon">“</div><p>Sejak mencatat dengan rutin, saya akhirnya tahu bukan cuma berapa uang yang tersisa—tetapi juga ke mana uang saya akan pergi.</p><span className="quote-avatar">A</span><strong>Alya Kusuma<small>Pengguna FinanceMy</small></strong></div>
    </section>

    <section className="auth-reference-form-wrap">
      <div className="auth-reference-form-card">
        <span className="reference-form-eyebrow">{isLogin ? 'SELAMAT DATANG KEMBALI' : 'PEMULIHAN AKUN'}</span>
        <h2>{title}</h2>
        <p>{subtitle}</p>

        <form className="reference-auth-form" onSubmit={handleSubmit(submit)} noValidate>
          <label>Email<div className={`reference-input ${errors.email ? 'invalid' : ''}`}><Mail/><input type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} inputMode="email" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'auth-email-error' : undefined} placeholder="Masukkan alamat email" {...register('email', { required: 'Email wajib diisi.', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Masukkan email yang valid.' } })}/></div>{errors.email && <small id="auth-email-error" className="field-error">{errors.email.message}</small>}</label>

          {mode !== 'forgot' && <label>Password<div className={`reference-input ${errors.password ? 'invalid' : ''}`}><LockKeyhole/><input type={showPassword ? 'text' : 'password'} autoComplete={isLogin ? 'current-password' : 'new-password'} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'auth-password-error' : undefined} placeholder="Minimal 8 karakter" {...register('password', { required: 'Password wajib diisi.', minLength: { value: 8, message: 'Password minimal 8 karakter.' } })}/><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'} aria-pressed={showPassword}>{showPassword ? <EyeOff/> : <Eye/>}</button></div>{errors.password && <small id="auth-password-error" className="field-error">{errors.password.message}</small>}</label>}

          {isLogin && <div className="reference-forgot"><Link to="/lupa-password">Lupa password?</Link></div>}
          {feedback && <div role={feedback.tone === 'error' ? 'alert' : 'status'} className={`form-feedback ${feedback.tone}`}>{feedback.text}</div>}
          <button className="reference-submit" disabled={busy} aria-busy={busy}>{busy ? <><span className="spinner"/> Memproses...</> : <>{isLogin ? 'Masuk ke FinanceMy' : 'Kirim tautan reset'}<ArrowRight/></>}</button>
        </form>

        {isLogin && <p className="auth-session-note"><ShieldCheck size={15}/>Tetap masuk di perangkat ini</p>}

        {mode !== 'forgot' && <>
          <div className="reference-divider"><span>ingin lihat-lihat dulu?</span></div>
          <button className="reference-demo" onClick={enterDemo} disabled={busy}>Lihat dashboard demo</button>
          <small className="reference-demo-note">Jelajahi dengan data contoh, tanpa akun.</small>
        </>}
        {!isLogin && <Link className="reference-back" to="/login"><ArrowLeft size={16}/>Kembali ke login</Link>}
      </div>
    </section>
  </main>
}
