import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleDollarSign,
  ExternalLink,
  Goal,
  Landmark,
  MessageCircle,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  WalletCards,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import brandLogo from '../../assets/financemy-logo-mark.png'
import heroVisual from '../../assets/financemy-hero-3d.png'
import smartCaptureVisual from '../../assets/financemy-smart-capture.png'
import './landing.css'

const salesNumber = (import.meta.env.VITE_SALES_WHATSAPP || '6285128026512').replace(/\D/g, '')
const salesMessage = encodeURIComponent('Halo Admin FinanceMy, saya tertarik untuk melihat demo dan mendapatkan akses FinanceMy.')
const salesUrl = `https://wa.me/${salesNumber}?text=${salesMessage}`

const audiences = [
  ['Pekerja aktif', Landmark],
  ['Freelancer', TrendingUp],
  ['Keluarga muda', WalletCards],
  ['Pengejar target', Goal],
]

const features = [
  {
    icon: BarChart3,
    title: 'Dashboard yang langsung terbaca',
    text: 'Saldo, pemasukan, pengeluaran, arus kas, dan kondisi budget tersaji dalam satu pandangan.',
    tone: 'mint',
  },
  {
    icon: WalletCards,
    title: 'Semua akun dalam satu tempat',
    text: 'Pantau rekening, tabungan, e-wallet, dan uang tunai tanpa kehilangan konteks aktivitasnya.',
    tone: 'blue',
  },
  {
    icon: CircleDollarSign,
    title: 'Budget yang lebih adaptif',
    text: 'Ketahui batas aman harian berdasarkan budget tersisa dan jumlah hari di bulan berjalan.',
    tone: 'amber',
  },
  {
    icon: CalendarClock,
    title: 'Tagihan dan transaksi rutin',
    text: 'Simpan kewajiban mendatang agar pembayaran penting tidak hilang di antara aktivitas harian.',
    tone: 'coral',
  },
  {
    icon: Goal,
    title: 'Target keuangan yang nyata',
    text: 'Bangun dana darurat, rencanakan pembelian, dan lihat progres tabungan dengan lebih jelas.',
    tone: 'violet',
  },
  {
    icon: ShieldCheck,
    title: 'Workspace pribadi dan aman',
    text: 'Setiap pengguna hanya dapat mengakses data finansial miliknya melalui autentikasi dan aturan Firebase.',
    tone: 'navy',
  },
]

const steps = [
  ['01', 'Dapatkan akun', 'Hubungi admin untuk demo, pilihan akses, dan pembuatan akun personal FinanceMy.'],
  ['02', 'Atur saldo awal', 'Tambahkan rekening, e-wallet, tabungan, atau uang tunai yang ingin dipantau.'],
  ['03', 'Catat aktivitas', 'Masukkan pemasukan, pengeluaran, transfer, tagihan, dan transaksi rutin.'],
  ['04', 'Buat keputusan', 'Gunakan laporan, budget, dan proyeksi untuk menentukan langkah berikutnya.'],
]

const faqs = [
  ['Bagaimana cara mendapatkan akun FinanceMy?', 'Klik Dapatkan akses lalu hubungi admin melalui WhatsApp. Admin akan membantu demo, pilihan akses, dan pembuatan akun personal.'],
  ['Apakah FinanceMy dapat digunakan dari HP?', 'Ya. FinanceMy dirancang responsif untuk browser desktop, tablet, dan smartphone.'],
  ['Apakah data saya bercampur dengan pengguna lain?', 'Tidak. Setiap akun memiliki ruang data sendiri dan aksesnya dibatasi melalui Firebase Authentication serta Firestore Rules.'],
  ['Apakah pencatatan melalui WhatsApp sudah tersedia?', 'Ya. Setelah chat dihubungkan dari Pengaturan, kamu dapat membuat draf transaksi lewat teks atau foto struk serta meminta saran keuangan dari Myoui berdasarkan data FinanceMy.'],
  ['Apakah saya dapat mencoba sebelum membeli?', 'Ya. Gunakan dashboard demo dari halaman login untuk mencoba alur utama tanpa membuat akun Firebase.'],
]

function Brand() {
  return <span className="marketing-brand"><span className="marketing-brand-mark"><img src={brandLogo} alt="" aria-hidden="true" /></span><span>Finance<strong>My</strong></span></span>
}

function ProductPreview() {
  return <div className="product-preview" data-reveal="zoom">
    <div className="preview-sidebar">
      <Brand />
      <span className="preview-nav active"><i /><b>Ringkasan</b></span>
      <span className="preview-nav"><i /><b>Transaksi</b></span>
      <span className="preview-nav"><i /><b>Budget</b></span>
      <span className="preview-nav"><i /><b>Laporan</b></span>
      <div className="preview-side-card"><small>PROYEKSI</small><strong>Rp 8,4 jt</strong><i><b /></i><span>Masih dalam batas aman</span></div>
    </div>
    <div className="preview-main">
      <header><span><small>SELASA, 1 SEPTEMBER</small><strong>Selamat datang, Raka</strong></span><button>+ Transaksi</button></header>
      <div className="preview-metrics">
        {[['Total saldo', 'Rp 12,8 jt'], ['Pemasukan', 'Rp 8,2 jt'], ['Pengeluaran', 'Rp 3,4 jt'], ['Arus kas bersih', 'Rp 4,8 jt']].map(([label, value], index) => <article key={label}><i className={`tone-${index}`} /><span><small>{label}</small><strong>{value}</strong></span></article>)}
      </div>
      <div className="preview-grid">
        <article className="preview-chart"><span><strong>Arus kas</strong><small>Enam bulan terakhir</small></span><div className="preview-chart-area"><i /><i /><i /><i /><i /><i /><svg viewBox="0 0 500 150" preserveAspectRatio="none"><path d="M0 128 C55 112,75 116,112 82 S185 110,224 66 S305 76,350 42 S430 64,500 20" fill="none" stroke="currentColor" strokeWidth="4"/></svg></div></article>
        <article className="preview-budget"><span><strong>Budget bulan ini</strong><small>68% terpakai</small></span><div className="preview-ring"><b>32%</b><small>tersisa</small></div><p><i /><span>Makan & Minum</span><b>62%</b></p><p><i /><span>Transportasi</span><b>48%</b></p></article>
        <article className="preview-transactions"><span><strong>Transaksi terbaru</strong><small>Hari ini</small></span>{[['Makan siang', '−Rp 42.000'], ['Gaji bulanan', '+Rp 8.200.000'], ['Transportasi', '−Rp 28.000']].map(([title, amount], index) => <p key={title}><i className={`tone-${index}`} /><span><strong>{title}</strong><small>{index === 1 ? 'Pemasukan' : 'Pengeluaran'}</small></span><b>{amount}</b></p>)}</article>
      </div>
    </div>
  </div>
}

export default function LandingPage() {
  const { user } = useAuth()
  const appTarget = user ? '/dashboard' : '/login'
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const updateNav = () => setScrolled(window.scrollY > 28)
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const revealItems = document.querySelectorAll('.marketing-page [data-reveal]')
    updateNav()
    window.addEventListener('scroll', updateNav, { passive: true })

    if (reducedMotion) {
      revealItems.forEach((item) => item.classList.add('is-visible'))
      return () => window.removeEventListener('scroll', updateNav)
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        observer.unobserve(entry.target)
      })
    }, { threshold: .12, rootMargin: '0px 0px -40px' })
    revealItems.forEach((item) => observer.observe(item))

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', updateNav)
    }
  }, [])

  return <div className="marketing-page">
    <header className={`marketing-nav-wrap ${scrolled ? 'scrolled' : ''}`}>
      <nav className="marketing-nav">
        <a href="#top" aria-label="FinanceMy beranda"><Brand /></a>
        <div className="marketing-nav-links"><a href="#fitur">Fitur</a><a href="#cara-kerja">Cara kerja</a><a href="#akses">Akses</a><a href="#faq">FAQ</a></div>
        <div className="marketing-nav-actions"><Link className="marketing-login" to={appTarget}>{user ? 'Buka dashboard' : 'Masuk'}</Link><a className="marketing-button primary compact" href={salesUrl} target="_blank" rel="noreferrer">Dapatkan akses <ArrowRight /></a></div>
      </nav>
    </header>

    <main>
      <section className="marketing-hero" id="top">
        <div className="marketing-hero-copy">
          <span className="marketing-pill"><Sparkles /> Personal finance workspace yang lebih tenang</span>
          <h1>Keuangan rapi.<br/><em>Hidup lebih tenang.</em></h1>
          <p>Satukan saldo, transaksi, budget, tagihan, dan target keuangan dalam satu ruang yang sederhana—agar kamu tahu kondisi uangmu dan langkah berikutnya.</p>
          <div className="marketing-hero-actions"><a className="marketing-button primary" href={salesUrl} target="_blank" rel="noreferrer"><MessageCircle /> Hubungi admin</a><Link className="marketing-button secondary" to={appTarget}>Coba dashboard demo <ArrowRight /></Link></div>
          <div className="marketing-proof"><span><CheckCircle2 /> Data akun terpisah</span><span><CheckCircle2 /> Responsif di semua perangkat</span><span><CheckCircle2 /> Demo tanpa registrasi</span></div>
        </div>
        <div className="marketing-hero-visual">
          <span className="hero-orbit one"/><span className="hero-orbit two"/>
          <img src={heroVisual} alt="Ilustrasi dashboard dan alat pengelolaan keuangan FinanceMy" />
          <div className="hero-float-card balance"><WalletCards/><span><small>Total saldo</small><strong>Semua akun terpantau</strong></span></div>
          <div className="hero-float-card safe"><TrendingUp/><span><small>Proyeksi bulan ini</small><strong>Dalam batas aman</strong></span></div>
        </div>
      </section>

      <section className="marketing-audience" data-reveal="zoom"><span>Dibuat untuk keputusan finansial sehari-hari</span><div>{audiences.map(([label, Icon]) => <b key={label}><Icon />{label}</b>)}</div></section>

      <section className="marketing-section marketing-problem">
        <div className="marketing-heading centered" data-reveal><span className="marketing-kicker">Lebih jelas, bukan lebih rumit</span><h2>Mengelola uang tidak seharusnya terasa seperti pekerjaan tambahan.</h2><p>FinanceMy menyatukan catatan yang tersebar menjadi gambaran keuangan yang mudah dipahami dan ditindaklanjuti.</p></div>
        <div className="problem-grid">
          <article data-reveal="left"><span>01</span><strong>Saldo tersebar di banyak tempat?</strong><p>Lihat seluruh akun aktif tanpa membuka aplikasi keuangan satu per satu.</p></article>
          <article data-reveal style={{ '--reveal-delay': '80ms' }}><span>02</span><strong>Sulit tahu uang pergi ke mana?</strong><p>Kategori dan laporan membantu menemukan pola pengeluaran yang paling besar.</p></article>
          <article data-reveal="right" style={{ '--reveal-delay': '160ms' }}><span>03</span><strong>Budget terasa cepat habis?</strong><p>Batas adaptif menghitung ulang ruang belanja berdasarkan sisa hari.</p></article>
        </div>
      </section>

      <section className="marketing-product-section" id="product-tour">
        <div className="marketing-section">
          <div className="marketing-heading split light" data-reveal><div><span className="marketing-kicker">Satu pandangan yang utuh</span><h2>Dari angka menjadi keputusan yang lebih tenang.</h2></div><p>Dashboard dirancang untuk menjawab tiga hal penting: berapa yang tersedia, apa yang akan datang, dan apakah rencanamu masih aman.</p></div>
          <ProductPreview />
        </div>
      </section>

      <section className="marketing-section marketing-features" id="fitur">
        <div className="marketing-heading centered" data-reveal><span className="marketing-kicker">Semua yang kamu butuhkan</span><h2>Bukan sekadar buku kas digital.</h2><p>Setiap fitur membantu kamu memahami kondisi sekarang sekaligus mempersiapkan kebutuhan berikutnya.</p></div>
        <div className="feature-grid">{features.map(({ icon: Icon, title, text, tone }, index) => <article key={title} data-reveal style={{ '--reveal-delay': `${(index % 3) * 75}ms` }}><span className={`feature-icon ${tone}`}><Icon /></span><h3>{title}</h3><p>{text}</p><small><CheckCircle2 /> Tersedia di FinanceMy</small></article>)}</div>
      </section>

      <section className="marketing-roadmap">
        <div className="marketing-section roadmap-inner">
          <div className="roadmap-visual" data-reveal="left"><span className="roadmap-glow"/><img src={smartCaptureVisual} alt="Ilustrasi pencatatan transaksi melalui percakapan dan pemindaian nota" loading="lazy"/></div>
          <div className="roadmap-copy" data-reveal="right"><span className="marketing-pill roadmap-pill"><Sparkles /> Dalam roadmap</span><h2>Catat dengan bahasa sehari-hari.</h2><p>Kami sedang mempersiapkan pencatatan transaksi melalui percakapan dan pembacaan nota. Setiap hasil tetap hadir sebagai draf untuk kamu periksa sebelum saldo berubah.</p><div><span><Check /> Tulis transaksi seperti mengirim chat</span><span><Check /> Ambil informasi penting dari foto nota</span><span><Check /> Konfirmasi sebelum transaksi disimpan</span></div><small>Fitur ini sedang dipersiapkan dan belum termasuk dalam versi aktif saat ini.</small></div>
        </div>
      </section>

      <section className="marketing-section marketing-how" id="cara-kerja">
        <div className="marketing-heading centered" data-reveal><span className="marketing-kicker">Mulai tanpa ribet</span><h2>Empat langkah menuju keuangan yang lebih tertata.</h2></div>
        <div className="steps-grid">{steps.map(([number, title, text], index) => <article key={number} data-reveal style={{ '--reveal-delay': `${index * 80}ms` }}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div>{index < steps.length - 1 && <ArrowRight />}</article>)}</div>
      </section>

      <section className="marketing-access" id="akses">
        <div className="marketing-section access-inner">
          <div className="access-copy" data-reveal="left"><span className="marketing-kicker">Akses FinanceMy</span><h2>Mulai dari kondisi uangmu hari ini.</h2><p>Coba dashboard demo untuk memahami alurnya, lalu hubungi admin ketika kamu siap menggunakan workspace milikmu sendiri.</p><div><span><ShieldCheck/>Akun diprovisi oleh admin</span><span><WalletCards/>Data pribadi terpisah</span><span><ReceiptText/>Ekspor data JSON dan CSV</span></div></div>
          <article className="access-card" data-reveal="right"><span>AKSES PERSONAL</span><h3>FinanceMy Workspace</h3><p>Untuk individu yang ingin membangun kebiasaan finansial yang lebih rapi.</p><ul><li><CheckCircle2/>Seluruh fitur pengelolaan keuangan</li><li><CheckCircle2/>Dashboard desktop dan mobile</li><li><CheckCircle2/>Akun personal terpisah</li><li><CheckCircle2/>Bantuan aktivasi dari admin</li></ul><strong>Hubungi admin untuk penawaran akses</strong><a className="marketing-button primary" href={salesUrl} target="_blank" rel="noreferrer"><MessageCircle/>Dapatkan akses <ExternalLink/></a><Link to={appTarget}>Coba dashboard terlebih dahulu <ArrowRight/></Link></article>
        </div>
      </section>

      <section className="marketing-section marketing-faq" id="faq">
        <div className="faq-intro" data-reveal="left"><span className="marketing-kicker">Pertanyaan umum</span><h2>Masih ada yang ingin kamu ketahui?</h2><p>Temukan jawaban singkat tentang akses, keamanan data, demo, dan roadmap FinanceMy.</p><a href={salesUrl} target="_blank" rel="noreferrer">Tanya langsung ke admin <ArrowRight/></a></div>
        <div className="faq-list" data-reveal="right">{faqs.map(([question, answer], index) => <details key={question} open={index === 0}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div>
      </section>

      <section className="marketing-section marketing-final" data-reveal="zoom"><div><span className="marketing-kicker">Your personal money workspace</span><h2>Lebih mudah merencanakan hidup ketika uangmu terasa jelas.</h2><p>Mulai dari dashboard demo, lalu bangun workspace keuanganmu bersama FinanceMy.</p><div><a className="marketing-button white" href={salesUrl} target="_blank" rel="noreferrer"><MessageCircle/>Hubungi admin</a><Link className="marketing-button ghost" to={appTarget}>{user ? 'Buka dashboard' : 'Coba demo'} <ArrowRight/></Link></div></div></section>
    </main>

    <footer className="marketing-footer"><div><Brand/><p>Ruang yang lebih tenang untuk memahami uang dan merencanakan langkah berikutnya.</p></div><div><strong>Jelajahi</strong><a href="#fitur">Fitur</a><a href="#cara-kerja">Cara kerja</a><a href="#akses">Akses</a></div><div><strong>FinanceMy</strong><Link to="/login">Masuk</Link><a href={salesUrl} target="_blank" rel="noreferrer">Hubungi admin <ExternalLink/></a></div><div className="marketing-footer-bottom"><span>© {new Date().getFullYear()} FinanceMy. All rights reserved.</span><span>Kelola uangmu dengan lebih sadar.</span></div></footer>
  </div>
}
