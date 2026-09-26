import { useState } from 'react'
import { useFinance } from '../../context/FinanceContext'
import { useTheme } from '../../context/ThemeContext'
import { buildMonthlyReport, jakartaDateKey, monthOffset, rupiah } from '../../utils/assistantReports'
import '../settings/assistant-settings.css'

export default function MonthlyReport() {
  const { transactions, recurringTransactions } = useFinance()
  const { hiddenAmounts } = useTheme()
  const today = jakartaDateKey()
  const lastMonth = monthOffset(today.slice(0, 7), -1)
  const [period, setPeriod] = useState(lastMonth)
  const [expanded, setExpanded] = useState(false)
  const report = buildMonthlyReport({ transactions, recurringTransactions }, period, today)
  return <section className="card monthly-report">
    <div className="section-head"><div><h2>Ringkasan bulanan Myoui</h2><p>Pratinjau pesan singkat untuk WhatsApp.</p></div><label>Bulan laporan <input type="month" value={period} max={lastMonth} onChange={(event) => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value) && event.target.value <= lastMonth) setPeriod(event.target.value) }}/></label></div>
    <div className="monthly-report-body">
      <pre className="monthly-message">{hiddenAmounts ? 'Nominal disembunyikan. Tampilkan nominal untuk membaca pratinjau laporan.' : report.text.replaceAll('*', '').replaceAll('_', '')}</pre>
      <div className="monthly-details"><p>Laporan menghitung pemasukan dan pengeluaran yang tercatat. Selisih bukan saldo atau jumlah tabungan.</p><p>Transfer antar-akun tidak dihitung sebagai pengeluaran; biaya admin tetap dihitung. Refund mengurangi pengeluaran.</p>
        <button className="secondary-btn" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Tutup rincian' : 'Lihat rincian bulanan'}</button>
        {expanded && <div>{report.categories.length ? report.categories.map((item) => <div key={item.name} className="monthly-category"><span>{item.name}</span><strong>{hiddenAmounts ? '••••••' : rupiah(item.value)}</strong></div>) : <p>Belum ada pengeluaran tercatat pada bulan ini.</p>}</div>}
        <p>Aktifkan pengiriman melalui Pengaturan → WhatsApp.</p>
      </div>
    </div>
  </section>
}
