import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { ArrowRight, Check, CreditCard, Eye, EyeOff, LockKeyhole, Mail, Sparkles } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const messages = {
  'auth/invalid-credential': 'Email atau password tidak sesuai.',
  'auth/email-already-in-use': 'Email ini sudah terdaftar. Silakan masuk.',
  'auth/too-many-requests': 'Terlalu banyak percobaan. Coba lagi beberapa saat.',
}

export default function AuthPage({ mode = 'login' }) {
  const [showPassword, setShowPassword] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [busy, setBusy] = useState(false)
  const { login, resetPassword, demoLogin } = useAuth()
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors } } = useForm()

  const submit = async (values) => {
    setBusy(true)
    setFeedback(null)
    try {
      if (mode === 'forgot') {
        await resetPassword(values.email)
        setFeedback({ tone: 'success', text: 'Tautan reset password sudah dikirim. Periksa email Anda.' })
      } else {
        await login(values.email, values.password)
        navigate('/dashboard')
      }
    } catch (error) {
      setFeedback({ tone: 'error', text: messages[error.code] || 'Terjadi kesalahan. Periksa data dan coba lagi.' })
    } finally {
      setBusy(false)
    }
  }

  const enterDemo = async () => { await demoLogin(); navigate('/dashboard') }
  const isLogin = mode === 'login'
  const title = isLogin ? 'Masuk ke akunmu' : 'Atur ulang password'
  const subtitle = isLogin ? 'Lanjutkan progres keuanganmu hari ini.' : 'Kami akan mengirim tautan pemulihan ke emailmu.'

  return <main className="auth-reference-page">
    <section className="auth-reference-visual">
      <Link className="auth-brand" to="/"><span><CreditCard size={23}/></span>Finance<b>My</b></Link>
      <div className="auth-copy">
        <span className="auth-kicker"><Sparkles size={15}/> Keuangan jadi lebih jelas</span>
        <h1>Tenang dengan uang.<br/><em>Yakin dengan rencana.</em></h1>
        <p>Kelola uangmu, pahami kebiasaanmu, dan rencanakan masa depanmu.</p>
        <div className="auth-benefits">
          <span><Check/>Semua saldo dalam satu pandangan</span>
          <span><Check/>Budget yang menyesuaikan kebiasaanmu</span>
          <span><Check/>Privasi data terlindungi Firebase</span>
        </div>
      </div>
      <div className="auth-quote"><div className="quote-icon">“</div><p>Sejak mencatat dengan rutin, saya akhirnya tahu bukan cuma berapa uang yang tersisa—tetapi juga ke mana uang saya akan pergi.</p><span className="quote-avatar">A</span><strong>Alya Kusuma<small>Pengguna FinanceMy</small></strong></div>
    </section>

    <section className="auth-reference-form-wrap">
      <div className="auth-reference-form-card">
        <span className="reference-form-eyebrow">{isLogin ? 'SELAMAT DATANG KEMBALI' : 'PEMULIHAN AKUN'}</span>
        <h2>{title}</h2>
        <p>{subtitle}</p>

        <form className="reference-auth-form" onSubmit={handleSubmit(submit)} noValidate>
          <label>Email<div className={`reference-input ${errors.email ? 'invalid' : ''}`}><Mail/><input type="email" autoComplete="email" placeholder="Masukkan alamat email" {...register('email', { required: 'Email wajib diisi.', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Masukkan email yang valid.' } })}/></div>{errors.email && <small className="field-error">{errors.email.message}</small>}</label>

          {mode !== 'forgot' && <label>Password<div className={`reference-input ${errors.password ? 'invalid' : ''}`}><LockKeyhole/><input type={showPassword ? 'text' : 'password'} autoComplete={isLogin ? 'current-password' : 'new-password'} placeholder="Minimal 8 karakter" {...register('password', { required: 'Password wajib diisi.', minLength: { value: 8, message: 'Password minimal 8 karakter.' } })}/><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}>{showPassword ? <EyeOff/> : <Eye/>}</button></div>{errors.password && <small className="field-error">{errors.password.message}</small>}</label>}

          {isLogin && <div className="reference-forgot"><Link to="/lupa-password">Lupa password?</Link></div>}
          {feedback && <div className={`form-feedback ${feedback.tone}`}>{feedback.text}</div>}
          <button className="reference-submit" disabled={busy}>{busy ? <span className="spinner"/> : <>{isLogin ? 'Masuk ke FinanceMy' : 'Kirim tautan reset'}<ArrowRight/></>}</button>
        </form>

        {mode !== 'forgot' && <>
          <div className="reference-divider"><span>atau coba tanpa membuat akun</span></div>
          <button className="reference-demo" onClick={enterDemo}>Lihat dashboard demo</button>
          <small className="reference-demo-note">Tidak memerlukan akun Firebase</small>
          {!isLogin&&<p className="reference-auth-switch"><Link to="/login">Kembali ke halaman login</Link></p>}
        </>}
      </div>
    </section>
  </main>
}
