import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { ArrowRight, Check, CreditCard, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Sparkles, UserRound } from 'lucide-react'
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
  const { login, register: createAccount, resetPassword, demoLogin } = useAuth()
  const navigate = useNavigate()
  const { register, handleSubmit, watch, formState: { errors } } = useForm()

  const submit = async (values) => {
    setBusy(true); setFeedback(null)
    try {
      if (mode === 'register') { await createAccount(values); navigate('/onboarding') }
      else if (mode === 'forgot') { await resetPassword(values.email); setFeedback({ tone: 'success', text: 'Tautan reset password sudah dikirim. Periksa email Anda.' }) }
      else { await login(values.email, values.password); navigate('/dashboard') }
    } catch (error) { setFeedback({ tone: 'error', text: messages[error.code] || 'Terjadi kesalahan. Periksa data dan coba lagi.' }) }
    finally { setBusy(false) }
  }

  const enterDemo = () => { demoLogin(); navigate('/dashboard') }
  const title = mode === 'login' ? 'Selamat datang kembali' : mode === 'register' ? 'Mulai perjalanan finansialmu' : 'Atur ulang password'
  const subtitle = mode === 'login' ? 'Masuk untuk melihat kondisi keuanganmu hari ini.' : mode === 'register' ? 'Satu tempat untuk uang yang lebih terarah.' : 'Kami akan mengirim tautan pemulihan ke emailmu.'

  return <main className="auth-page">
    <section className="auth-visual">
      <Link className="auth-brand" to="/"><span><CreditCard size={23} /></span>Finance<b>My</b></Link>
      <div className="auth-copy"><span className="auth-kicker"><Sparkles size={15} /> Keuangan jadi lebih jelas</span><h1>Tenang dengan uang.<br/><em>Yakin dengan rencana.</em></h1><p>Kelola uangmu, pahami kebiasaanmu, dan rencanakan masa depanmu.</p>
        <div className="auth-benefits"><span><Check />Semua saldo dalam satu pandangan</span><span><Check />Budget yang menyesuaikan kebiasaanmu</span><span><Check />Privasi data terlindungi Firebase</span></div>
      </div>
      <div className="auth-quote"><div className="quote-icon">“</div><p>Sejak mencatat dengan rutin, saya akhirnya tahu bukan cuma berapa uang yang tersisa—tetapi juga ke mana uang saya akan pergi.</p><span className="quote-avatar">A</span><strong>Alya Kusuma<small>Pengguna FinanceMy</small></strong></div>
    </section>
    <section className="auth-form-wrap"><div className="auth-form-card">
      <div className="secure-label"><ShieldCheck size={16} /> Koneksi aman</div><h2>{title}</h2><p>{subtitle}</p>
      <form onSubmit={handleSubmit(submit)} noValidate>
        {mode === 'register' && <label>Nama lengkap<div className={`input-shell ${errors.name ? 'invalid' : ''}`}><UserRound size={18}/><input placeholder="Nama kamu" {...register('name', { required: 'Nama wajib diisi.' })}/></div>{errors.name && <small className="field-error">{errors.name.message}</small>}</label>}
        <label>Email<div className={`input-shell ${errors.email ? 'invalid' : ''}`}><Mail size={18}/><input type="email" placeholder="nama@email.com" {...register('email', { required: 'Email wajib diisi.', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Masukkan email yang valid.' } })}/></div>{errors.email && <small className="field-error">{errors.email.message}</small>}</label>
        {mode !== 'forgot' && <label>Password<div className={`input-shell ${errors.password ? 'invalid' : ''}`}><LockKeyhole size={18}/><input type={showPassword ? 'text' : 'password'} placeholder="Minimal 8 karakter" {...register('password', { required: 'Password wajib diisi.', minLength: { value: 8, message: 'Password minimal 8 karakter.' } })}/><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label="Tampilkan password">{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>{errors.password && <small className="field-error">{errors.password.message}</small>}</label>}
        {mode === 'register' && <label>Konfirmasi password<div className={`input-shell ${errors.confirmPassword ? 'invalid' : ''}`}><LockKeyhole size={18}/><input type="password" placeholder="Ulangi password" {...register('confirmPassword', { validate: (value) => value === watch('password') || 'Konfirmasi password tidak sama.' })}/></div>{errors.confirmPassword && <small className="field-error">{errors.confirmPassword.message}</small>}</label>}
        {mode === 'login' && <div className="auth-options"><label><input type="checkbox"/> Ingat saya</label><Link to="/lupa-password">Lupa password?</Link></div>}
        {feedback && <div className={`form-feedback ${feedback.tone}`}>{feedback.text}</div>}
        <button className="primary-btn auth-submit" disabled={busy}>{busy ? <span className="spinner" /> : <>{mode === 'login' ? 'Masuk ke akun' : mode === 'register' ? 'Buat akun gratis' : 'Kirim tautan reset'}<ArrowRight size={18}/></>}</button>
      </form>
      {mode === 'login' && <><div className="divider"><span>atau lihat aplikasinya</span></div><button className="demo-btn" onClick={enterDemo}>Masuk dengan data demo <ArrowRight size={17}/></button></>}
      <p className="auth-switch">{mode === 'register' ? 'Sudah punya akun?' : mode === 'forgot' ? 'Ingat password-mu?' : 'Belum punya akun?'} <Link to={mode === 'register' || mode === 'forgot' ? '/login' : '/register'}>{mode === 'register' || mode === 'forgot' ? 'Masuk' : 'Daftar gratis'}</Link></p>
      <small className="auth-legal">Dengan melanjutkan, Anda menyetujui Ketentuan Layanan dan Kebijakan Privasi FinanceMy.</small>
    </div></section>
  </main>
}
