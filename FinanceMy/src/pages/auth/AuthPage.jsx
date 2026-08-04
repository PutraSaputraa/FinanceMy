import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react'
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
    setBusy(true)
    setFeedback(null)
    try {
      if (mode === 'register') {
        await createAccount(values)
        navigate('/onboarding')
      } else if (mode === 'forgot') {
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

  const enterDemo = () => {
    demoLogin()
    navigate('/dashboard')
  }

  const isLogin = mode === 'login'
  const isRegister = mode === 'register'
  const title = isLogin ? 'Masuk ke akunmu' : isRegister ? 'Buat akun barumu' : 'Atur ulang password'
  const subtitle = isLogin
    ? 'Lanjutkan progres keuanganmu hari ini.'
    : isRegister
      ? 'Mulai kelola uang dan rencanakan masa depanmu.'
      : 'Kami akan mengirim tautan pemulihan ke emailmu.'

  return <main className="simple-auth-page">
    <section className="simple-auth-card">
      {mode === 'forgot' && <Link className="auth-back" to="/login"><ArrowLeft /> Kembali ke login</Link>}
      <span className="simple-auth-eyebrow">{isLogin ? 'SELAMAT DATANG KEMBALI' : isRegister ? 'MULAI BERSAMA FINANCEMY' : 'PEMULIHAN AKUN'}</span>
      <h1>{title}</h1>
      <p className="simple-auth-subtitle">{subtitle}</p>

      {mode !== 'forgot' && <div className="auth-tabs" role="tablist" aria-label="Pilih autentikasi">
        <Link role="tab" aria-selected={isLogin} className={isLogin ? 'active' : ''} to="/login">Login</Link>
        <Link role="tab" aria-selected={isRegister} className={isRegister ? 'active' : ''} to="/register">Register</Link>
      </div>}

      <form className="simple-auth-form" onSubmit={handleSubmit(submit)} noValidate>
        {isRegister && <label>
          Nama lengkap
          <div className={`simple-input ${errors.name ? 'invalid' : ''}`}><UserRound /><input autoComplete="name" placeholder="Masukkan nama lengkap" {...register('name', { required: 'Nama wajib diisi.' })}/></div>
          {errors.name && <small className="field-error">{errors.name.message}</small>}
        </label>}

        <label>
          Email
          <div className={`simple-input ${errors.email ? 'invalid' : ''}`}><Mail /><input type="email" autoComplete="email" placeholder="Masukkan alamat email" {...register('email', { required: 'Email wajib diisi.', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Masukkan email yang valid.' } })}/></div>
          {errors.email && <small className="field-error">{errors.email.message}</small>}
        </label>

        {mode !== 'forgot' && <label>
          Password
          <div className={`simple-input ${errors.password ? 'invalid' : ''}`}><LockKeyhole /><input type={showPassword ? 'text' : 'password'} autoComplete={isLogin ? 'current-password' : 'new-password'} placeholder="Minimal 8 karakter" {...register('password', { required: 'Password wajib diisi.', minLength: { value: 8, message: 'Password minimal 8 karakter.' } })}/><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}>{showPassword ? <EyeOff /> : <Eye />}</button></div>
          {errors.password && <small className="field-error">{errors.password.message}</small>}
        </label>}

        {isRegister && <label>
          Konfirmasi password
          <div className={`simple-input ${errors.confirmPassword ? 'invalid' : ''}`}><LockKeyhole /><input type="password" autoComplete="new-password" placeholder="Ulangi password" {...register('confirmPassword', { validate: (value) => value === watch('password') || 'Konfirmasi password tidak sama.' })}/></div>
          {errors.confirmPassword && <small className="field-error">{errors.confirmPassword.message}</small>}
        </label>}

        {isLogin && <div className="simple-forgot"><Link to="/lupa-password">Lupa password?</Link></div>}
        {feedback && <div className={`form-feedback ${feedback.tone}`}>{feedback.text}</div>}
        <button className="simple-auth-submit" disabled={busy}>{busy ? <span className="spinner" /> : <>{isLogin ? 'Masuk ke FinanceMy' : isRegister ? 'Daftar ke FinanceMy' : 'Kirim tautan reset'}<ArrowRight /></>}</button>
      </form>

      {mode !== 'forgot' && <>
        <div className="simple-divider"><span>atau coba tanpa membuat akun</span></div>
        <button className="simple-demo-button" onClick={enterDemo}>Lihat dashboard demo</button>
        <small className="simple-demo-note">Tidak memerlukan akun Firebase</small>
        <p className="simple-auth-switch">{isLogin ? 'Belum punya akun?' : 'Sudah punya akun?'} <Link to={isLogin ? '/register' : '/login'}>{isLogin ? 'Daftar sekarang' : 'Login sekarang'}</Link></p>
      </>}
    </section>
  </main>
}
