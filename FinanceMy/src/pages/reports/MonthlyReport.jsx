import { useState } from 'react'
import { ArrowRight, ChevronDown, Copy, MessageCircle } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useFinance } from '../../context/FinanceContext'
import { useTheme } from '../../context/ThemeContext'
import { buildMonthlyReport, jakartaDateKey, monthOffset, rupiah } from '../../utils/assistantReports'
import { monthBounds, transactionLink } from '../../utils/transactionHistory'
import '../settings/assistant-settings.css'

export default function MonthlyReport() {
  const location = useLocation()
  const { transactions, recurringTransactions, today: referenceDate, notify } = useFinance()
  const { hiddenAmounts } = useTheme()
  const today = jakartaDateKey(referenceDate)
  const lastMonth = monthOffset(today.slice(0, 7), -1)
  const saved = location.state?.monthlyReport
  const [period, setPeriod] = useState(() => /^\d{4}-(0[1-9]|1[0-2])$/.test(saved?.period || '') && saved.period >= '1900-01' && saved.period <= lastMonth ? saved.period : lastMonth)
  const [expanded, setExpanded] = useState(saved?.expanded === true)
  const [previewOpen, setPreviewOpen] = useState(saved?.previewOpen === true)
  const report = buildMonthlyReport({ transactions, recurringTransactions }, period, today)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report.text.replaceAll('*', '').replaceAll('_', ''))
      notify('Teks laporan berhasil disalin')
    } catch {
      notify('Teks belum bisa disalin. Coba lagi dari browser yang mendukung clipboard.')
    }
  }
  return <section className="card monthly-report">
    <div className="monthly-preview-heading"><span className="monthly-preview-icon"><MessageCircle size={21}/></span><div><h2>Ringkasan bulanan Myoui</h2><p>Pratinjau dan salin laporan bulan yang sudah selesai untuk WhatsApp.</p></div><button className="secondary-btn" aria-expanded={previewOpen} aria-controls="monthly-preview" onClick={() => setPreviewOpen(!previewOpen)}>{previewOpen ? 'Tutup pratinjau' : 'Buka pratinjau'}<ChevronDown size={15}/></button></div>
    {previewOpen && <div id="monthly-preview">
    <div className="monthly-preview-controls"><label>Bulan laporan <input type="month" value={period} max={lastMonth} onChange={(event) => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value) && event.target.value <= lastMonth) setPeriod(event.target.value) }}/></label><button className="secondary-btn" onClick={copy} disabled={hiddenAmounts}><Copy size={14}/>Salin teks laporan</button></div>
    <div className="monthly-report-body">
      <pre className="monthly-message">{hiddenAmounts ? 'Nominal disembunyikan. Tampilkan nominal untuk membaca pratinjau laporan.' : report.text.replaceAll('*', '').replaceAll('_', '')}</pre>
      <div className="monthly-details"><p>Laporan menghitung pemasukan dan pengeluaran yang tercatat. Selisih bukan saldo atau jumlah tabungan.</p><p>Transfer antar-akun tidak dihitung sebagai pengeluaran; biaya admin tetap dihitung. Refund mengurangi pengeluaran.</p>
        <button className="secondary-btn" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Tutup rincian' : 'Lihat rincian bulanan'}</button>
        {expanded && <div>{report.categories.length ? <><p>Pilih kategori untuk membuka seluruh transaksi pada bulan laporan ini.</p>{report.categories.map((item) => <Link key={item.name} className="monthly-category" to={transactionLink(monthBounds(period), { category: item.name })} state={{ reportSearch: location.search, monthlyReport: { period, expanded, previewOpen } }} aria-label={`Lihat transaksi bulanan kategori ${item.name}`}><span>{item.name}<small>Lihat transaksi</small></span><strong>{hiddenAmounts ? '••••••' : rupiah(item.value)}</strong><ArrowRight size={15}/></Link>)}</> : <p>Belum ada pengeluaran tercatat pada bulan ini.</p>}</div>}
        <p>Periode pesan ini dipilih terpisah dari grafik di atas. Atur pengiriman di WhatsApp melalui <Link to="/pengaturan">Pengaturan →</Link></p>
      </div>
    </div>
    </div>}
  </section>
}
