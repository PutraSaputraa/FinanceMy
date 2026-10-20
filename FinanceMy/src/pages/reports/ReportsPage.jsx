import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownLeft, ArrowRight, ArrowUpRight, CalendarDays, ChartNoAxesCombined, ChevronDown, Download, Info, ReceiptText, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import PageTitle from '../../components/common/PageTitle'
import DatePeriodFilter from '../../components/common/DatePeriodFilter'
import { useFinance } from '../../context/FinanceContext'
import { useTheme } from '../../context/ThemeContext'
import { jakartaDateKey } from '../../utils/assistantReports'
import { downloadCsv, transactionCsvRows } from '../../utils/csvExport'
import { formatCompact, formatCurrency } from '../../utils/formatters'
import { useFilterParams } from '../../utils/useFilterParams'
import { buildRangeSeries, comparisonPeriod, daysBetween, displayRange, groupTransactionsByDay, inDateRange, periodFromParams, reportRange, resolvePeriod, setPeriodParams, summarizeTransactions, transactionDateKey, transactionLink } from '../../utils/transactionHistory'
import MonthlyReport from './MonthlyReport'
import './reports.css'

function ReportMetric({ label, value, icon: Icon, tone, current, previous, hasPrevious, money, note }) {
  const change = hasPrevious && previous > 0 ? ((current - previous) / previous) * 100 : null
  const good = tone === 'expense' ? change <= 0 : change >= 0
  const Trend = change < 0 ? TrendingDown : TrendingUp
  return <article className={`report-stat ${tone || ''}`}>
    <div className="report-stat-top"><span>{label}</span><i><Icon size={18}/></i></div>
    <strong>{money(value)}</strong>
    {note ? <p>{note}</p> : <p className={change === null ? '' : good ? 'favorable' : 'unfavorable'}>
      {change !== null ? <><Trend size={13}/>{Math.abs(change).toLocaleString('id-ID', { maximumFractionDigits: 1 })}% {change < 0 ? 'lebih rendah' : change > 0 ? 'lebih tinggi' : 'berubah'}</> : hasPrevious ? `Sebelumnya ${money(previous)}` : 'Belum ada data pembanding'}
    </p>}
  </article>
}

function ReportTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return <div className="report-chart-tooltip"><strong>{displayRange(row.start, row.end)}</strong>{payload.map((item) => <div key={item.dataKey}><span><i style={{ background: item.color }}/>{item.name}</span><b>{formatCurrency(item.value)}</b></div>)}</div>
}

export default function ReportsPage() {
  const location = useLocation()
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }) }, [])
  const { transactions, today } = useFinance()
  const { hiddenAmounts } = useTheme()
  const [params, setParams] = useFilterParams()
  const [chart, setChart] = useState('flow')
  const [showAllCategories, setShowAllCategories] = useState(false)
  const [showAllRows, setShowAllRows] = useState(false)
  const dateKey = jakartaDateKey(today)
  const period = periodFromParams(params, dateKey, 'month')
  const selected = resolvePeriod(period, { today: dateKey, throughToday: true })
  const filtered = transactions.filter((item) => transactionDateKey(item) && inDateRange(item, selected))
  const range = reportRange(selected, filtered)
  const current = summarizeTransactions(filtered)
  const comparison = comparisonPeriod(period, range, dateKey)
  const previous = summarizeTransactions(comparison ? transactions.filter((item) => inDateRange(item, comparison)) : [])
  const series = buildRangeSeries(filtered, range)
  const dayCount = range.start && range.end ? daysBetween(range.start, range.end) : 0
  const dailyAverage = dayCount ? current.expense / dayCount : 0
  const money = (value) => hiddenAmounts ? '••••••' : formatCurrency(value)
  const largestCategory = current.categories.find((item) => item.value > 0)
  const positiveCategoryTotal = current.categories.reduce((sum, item) => sum + Math.max(item.value, 0), 0)
  const peakDay = groupTransactionsByDay(filtered, dateKey).sort((a, b) => b.summary.expense - a.summary.expense).find((group) => group.summary.expense > 0)
  const largestTransactions = [...filtered].filter((item) => item.type === 'expense').sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 5)
  const categories = showAllCategories ? current.categories : current.categories.slice(0, 6)
  const rows = showAllRows ? series.rows : series.rows.slice(-7)
  const caption = range.start && range.end ? displayRange(range.start, range.end) : 'Belum ada rentang transaksi'
  const insightTitle = largestCategory ? `Kategori pengeluaran terbesar: ${largestCategory.name}` : current.expense < 0 ? 'Refund melebihi pengeluaran periode ini' : 'Pemasukan sudah tercatat'
  const changePeriod = (patch) => {
    setParams((current) => {
      const value = periodFromParams(current, dateKey, 'month')
      return setPeriodParams(current, { ...value, ...(typeof patch === 'function' ? patch(value) : patch) })
    })
    setShowAllCategories(false)
    setShowAllRows(false)
  }
  const exportReport = () => downloadCsv(`laporan-${range.start || 'semua'}_${range.end || dateKey}.csv`, [
    ['Laporan keuangan FinanceMy'], ['Periode', caption],
    ['Pemasukan (Rp)', current.income], ['Pengeluaran bersih (Rp)', current.expense], ['Arus kas bersih (Rp)', current.net], ['Rata-rata pengeluaran per hari (Rp)', dailyAverage], ['Jumlah hari', dayCount],
    ['Pengeluaran sebelum refund (Rp)', current.grossExpense], ['Refund (Rp)', current.refunds], ['Biaya admin transfer (Rp)', current.transferFees], [],
    ['Kategori', 'Pengeluaran bersih (Rp)'], ...current.categories.map((item) => [item.name, item.value]), [],
    ['Mulai', 'Sampai', 'Pemasukan (Rp)', 'Pengeluaran bersih (Rp)', 'Arus kas bersih (Rp)', 'Akumulasi arus kas (Rp)'],
    ...series.rows.map((row) => [row.start, row.end, row.income, row.expense, row.net, row.cumulative]), [],
    ['Transaksi pada periode ini'], ...transactionCsvRows(groupTransactionsByDay(filtered, dateKey).flatMap((group) => group.transactions)),
  ])

  return <div className="reports-page">
    <PageTitle eyebrow="PAHAMI POLA KEUANGANMU" title="Laporan keuangan" subtitle="Dari catatan harian menjadi gambaran yang lebih jelas." action={<button className="secondary-btn" onClick={exportReport} disabled={Boolean(range.error) || !filtered.length}><Download size={16}/>Ekspor laporan</button>}/>
    <section className="card report-period-card" aria-label="Periode laporan">
      <DatePeriodFilter value={period} onChange={changePeriod} error={range.error}/>
      {!range.error && <div className="report-period-context"><span><CalendarDays size={14}/>{caption}{dayCount > 0 && ` · ${dayCount} hari`}</span>{comparison && <span>Dibandingkan {comparison.label}</span>}</div>}
    </section>
    {!range.error && <>
      <section className="report-stat-grid" aria-label="Ringkasan laporan">
        <ReportMetric label="Pemasukan" icon={ArrowDownLeft} tone="income" value={current.income} current={current.income} previous={previous.income} hasPrevious={previous.count > 0} money={money}/>
        <ReportMetric label="Pengeluaran bersih" icon={ArrowUpRight} tone="expense" value={current.expense} current={current.expense} previous={previous.expense} hasPrevious={previous.count > 0} money={money}/>
        <ReportMetric label="Arus kas bersih" icon={Wallet} tone="net" value={current.net} money={money} note={current.count ? current.net > 0 ? 'Pemasukan melebihi pengeluaran' : current.net < 0 ? 'Pengeluaran melebihi pemasukan' : 'Pemasukan sama dengan pengeluaran' : 'Belum ada aktivitas arus kas'}/>
        <ReportMetric label="Rata-rata pengeluaran / hari" icon={CalendarDays} value={dailyAverage} money={money} note={dayCount ? `Dibagi ${dayCount} hari, termasuk hari tanpa transaksi` : 'Catat transaksi untuk melihat rata-rata'}/>
      </section>
      {current.count > 0 ? <div className="report-insight-strip"><span className="report-insight-icon"><ChartNoAxesCombined size={21}/></span><div><strong>{insightTitle}</strong><p>{largestCategory ? `${money(largestCategory.value)} dari kategori ini.${peakDay ? ` Pengeluaran harian tertinggi: ${displayRange(peakDay.date, peakDay.date)} (${money(peakDay.summary.expense)}).` : ''}` : `${current.count} transaksi memengaruhi arus kas pada periode ini.`}</p></div><Link to={transactionLink(range)}>Lihat transaksi<ArrowRight size={15}/></Link></div> : <section className="card report-no-data"><ReceiptText size={28}/><div><h2>Belum ada aktivitas arus kas pada periode ini</h2><p>Pilih periode lain atau mulai mencatat pemasukan dan pengeluaran.</p></div><Link className="secondary-btn" to={transactionLink(range, { add: 'true' })}>Catat transaksi<ArrowRight size={15}/></Link></section>}

      <div className="report-analysis-grid">
        <section className="card report-flow-card" aria-label="Grafik arus kas">
          <div className="report-card-head"><div><h2>Arus kas sepanjang periode</h2><p>{chart === 'flow' ? `Pemasukan dan pengeluaran bersih per ${series.unit}` : 'Akumulasi selisih pemasukan dan pengeluaran, dimulai dari nol'}</p></div><div className="report-chart-tabs" role="group" aria-label="Tampilan grafik"><button aria-pressed={chart === 'flow'} className={chart === 'flow' ? 'active' : ''} onClick={() => setChart('flow')}>Arus kas</button><button aria-pressed={chart === 'cumulative'} className={chart === 'cumulative' ? 'active' : ''} onClick={() => setChart('cumulative')}>Akumulasi</button></div></div>
          <div className="report-chart-legend">{chart === 'flow' ? <><span><i className="income"/>Pemasukan</span><span><i className="expense"/>Pengeluaran bersih</span></> : <span><i className="income"/>Akumulasi arus kas</span>}</div>
          {current.count && !hiddenAmounts ? <div className="report-chart"><ResponsiveContainer width="100%" height="100%" minWidth={0}>
            {chart === 'flow' ? <BarChart data={series.rows} margin={{ top: 15, right: 8, bottom: 8, left: 0 }} barGap={3}>
              <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 4"/>
              <XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={26} tickMargin={12}/><YAxis axisLine={false} tickLine={false} tickFormatter={formatCompact} width={58}/>
              <Tooltip content={<ReportTooltip/>} cursor={{ fill: 'var(--surface-2)' }}/><ReferenceLine y={0} stroke="var(--line)"/>
              <Bar dataKey="income" name="Pemasukan" fill="#0b8f68" radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false}/><Bar dataKey="expense" name="Pengeluaran bersih" fill="#dc7771" radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false}/>
            </BarChart> : <AreaChart data={series.rows} margin={{ top: 15, right: 8, bottom: 8, left: 0 }}>
              <defs><linearGradient id="report-cash-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0b8f68" stopOpacity={0.22}/><stop offset="100%" stopColor="#0b8f68" stopOpacity={0.01}/></linearGradient></defs>
              <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 4"/>
              <XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={26} tickMargin={12}/><YAxis axisLine={false} tickLine={false} tickFormatter={formatCompact} width={58}/>
              <Tooltip content={<ReportTooltip/>}/><ReferenceLine y={0} stroke="var(--muted)" strokeDasharray="3 3"/>
              <Area type="linear" dataKey="cumulative" name="Akumulasi arus kas" stroke="#0b8f68" strokeWidth={2.5} fill="url(#report-cash-gradient)" isAnimationActive={false}/>
            </AreaChart>}
          </ResponsiveContainer></div> : <div className="report-chart-placeholder"><ChartNoAxesCombined size={30}/><p>{hiddenAmounts ? 'Tampilkan nominal untuk melihat grafik.' : 'Grafik akan terisi setelah ada transaksi pada periode ini.'}</p></div>}
          <p className="report-chart-note"><Info size={12}/>Arus kas bersih menunjukkan selisih transaksi, bukan saldo akun atau jumlah tabungan.</p>
        </section>

        <section className="card report-categories-card">
          <div className="report-card-head"><div><h2>Ke mana uangmu pergi?</h2><p>Pengeluaran bersih per kategori. Pilih kategori untuk melihat transaksinya.</p></div><span className="report-count-pill">{current.categories.length} kategori</span></div>
          {categories.length ? <div className="report-category-list">{categories.map((item) => {
            const share = positiveCategoryTotal && item.value > 0 ? item.value / positiveCategoryTotal * 100 : 0
            return <Link className="report-category-row" key={item.name} to={transactionLink(range, { category: item.name })} state={{ reportSearch: location.search }} aria-label={`Lihat transaksi kategori ${item.name}`}>
              <div><span><i style={{ background: item.color }}/>{item.name}</span><strong>{money(item.value)}</strong></div>
              <div className="report-category-track"><i style={{ width: `${share}%`, background: item.color }}/></div><small><span>{item.value < 0 ? 'Refund bersih' : `${share.toLocaleString('id-ID', { maximumFractionDigits: 1 })}% dari kategori dengan pengeluaran positif`}</span><span className="report-category-action">Lihat transaksi<ArrowRight size={12}/></span></small>
            </Link>
          })}</div> : <div className="report-small-empty"><ReceiptText size={25}/><p>Belum ada pengeluaran atau refund pada periode ini.</p></div>}
          {current.categories.length > 6 && <button className="report-text-button" onClick={() => setShowAllCategories(!showAllCategories)}>{showAllCategories ? 'Tampilkan lebih sedikit' : `Lihat semua ${current.categories.length} kategori`}<ChevronDown size={14}/></button>}
        </section>
      </div>

      <div className="report-detail-grid">
        <section className="card report-breakdown-card">
          <div className="report-card-head"><div><h2>Rincian per {series.unit}</h2><p>Klik tanggal untuk membuka transaksi pada periode tersebut.</p></div><span className="report-count-pill">{current.count} transaksi arus kas</span></div>
          {series.rows.length ? <>
            <p className="report-scroll-hint">Geser tabel ke samping untuk melihat semua kolom.</p>
            <div className="report-table-scroll" tabIndex={0} aria-label="Rincian arus kas, dapat digeser ke samping"><table className="report-breakdown"><thead><tr><th>Periode</th><th>Pemasukan</th><th>Pengeluaran</th><th>Selisih</th></tr></thead><tbody>{rows.map((row) => <tr key={row.start}><td><Link to={transactionLink(row)}>{row.label}<ArrowUpRight size={11}/></Link></td><td>{money(row.income)}</td><td>{money(row.expense)}</td><td className={row.net < 0 ? 'report-negative' : 'report-positive'}>{money(row.net)}</td></tr>)}</tbody><tfoot><tr><th>Total</th><td>{money(current.income)}</td><td>{money(current.expense)}</td><td>{money(current.net)}</td></tr></tfoot></table></div>
            {series.rows.length > 7 && <button className="report-text-button" onClick={() => setShowAllRows(!showAllRows)}>{showAllRows ? 'Tampilkan 7 periode terakhir' : `Lihat semua ${series.rows.length} periode`}<ChevronDown size={14}/></button>}
            {!showAllRows && series.rows.length > 7 && <p className="report-table-hint">Menampilkan 7 periode terakhir. Total mencakup seluruh periode terpilih.</p>}
          </> : <div className="report-small-empty"><p>Rincian akan muncul setelah transaksi dicatat.</p></div>}
        </section>
        <section className="card report-largest-card"><div className="report-card-head"><div><h2>Pengeluaran terbesar</h2><p>Transaksi pengeluaran sebelum refund</p></div></div>{largestTransactions.length ? <div className="report-largest-list">{largestTransactions.map((item, index) => <Link key={item.id} to={transactionLink(range, { search: item.title, type: 'expense' })}><span className="report-rank">{index + 1}</span><div><strong>{item.title}</strong><small>{item.accountName || item.account} · {transactionDateKey(item)}</small></div><b>{money(item.amount)}</b></Link>)}</div> : <div className="report-small-empty"><ReceiptText size={25}/><p>Belum ada transaksi pengeluaran.</p></div>}</section>
      </div>

      <details className="report-method"><summary><Info size={14}/>Cara laporan dihitung<ChevronDown size={14}/></summary><div><p>Pengeluaran bersih = pengeluaran {money(current.grossExpense)} + biaya admin transfer {money(current.transferFees)} − refund {money(current.refunds)}. Transfer antar-akun dan penyesuaian saldo tidak dianggap pemasukan atau pengeluaran.</p><p>{period.mode === 'month' && period.month === dateKey.slice(0, 7) ? 'Bulan berjalan dihitung sampai hari ini dan dibandingkan dengan tanggal yang sama pada bulan sebelumnya, atau hari terakhir bila bulannya lebih pendek. ' : period.mode === 'range' ? 'Rentang tanggal mencakup tanggal mulai dan akhir. Pembanding memakai jumlah hari yang sama, tepat sebelum rentang terpilih. ' : period.mode === 'month' ? 'Bulan yang sudah lewat dibandingkan dengan seluruh bulan sebelumnya. ' : 'Semua waktu memakai tanggal transaksi pertama sampai terakhir dan tidak memakai pembanding. '}Rata-rata memakai seluruh hari pada rentang laporan, termasuk hari tanpa transaksi. Hasil mencerminkan transaksi yang dicatat.</p></div></details>
    </>}
    <MonthlyReport/>
  </div>
}
