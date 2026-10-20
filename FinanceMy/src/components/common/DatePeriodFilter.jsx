import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { monthOffset } from '../../utils/assistantReports'
import './date-period-filter.css'

export default function DatePeriodFilter({ value, onChange, error }) {
  const validMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(value.month)
  return <div className="date-period-filter">
    <div className="date-period-top">
      <span className="period-caption"><CalendarDays size={17}/>Periode</span>
      <div className="period-modes" role="group" aria-label="Jenis periode">
        {[['all', 'Semua waktu'], ['month', 'Bulanan'], ['range', 'Rentang tanggal']].map(([mode, label]) => <button type="button" key={mode} aria-pressed={value.mode === mode} className={value.mode === mode ? 'active' : ''} onClick={() => onChange({ mode })}>{label}</button>)}
      </div>
      {value.mode === 'month' && <div className="period-month-controls">
        <button type="button" aria-label="Bulan sebelumnya" disabled={!validMonth || value.month <= '1900-01'} onClick={() => onChange((current) => ({ month: monthOffset(current.month, -1) }))}><ChevronLeft size={17}/></button>
        <label className="sr-only" htmlFor="period-month">Bulan</label><input id="period-month" type="month" min="1900-01" max="9998-12" value={value.month} onChange={(event) => onChange({ month: event.target.value })}/>
        <button type="button" aria-label="Bulan berikutnya" disabled={!validMonth || value.month >= '9998-12'} onClick={() => onChange((current) => ({ month: monthOffset(current.month, 1) }))}><ChevronRight size={17}/></button>
      </div>}
      {value.mode === 'range' && <div className="period-range-controls">
        <label>Dari tanggal<input type="date" min="1900-01-01" max="9998-12-31" value={value.start} aria-invalid={Boolean(error)} onChange={(event) => onChange({ start: event.target.value })}/></label>
        <span aria-hidden="true">→</span>
        <label>Sampai tanggal<input type="date" min={value.start || '1900-01-01'} max="9998-12-31" value={value.end} aria-invalid={Boolean(error)} onChange={(event) => onChange({ end: event.target.value })}/></label>
      </div>}
    </div>
    {error && <p className="period-error" role="alert">{error}</p>}
  </div>
}
