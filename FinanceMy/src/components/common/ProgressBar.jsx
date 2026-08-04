export default function ProgressBar({ value, color = 'var(--emerald)', label }) {
  const bounded = Math.min(Math.max(value, 0), 100)
  return <div className="progress-wrap">
    {label && <div className="progress-label"><span>{label}</span><strong>{Math.round(value)}%</strong></div>}
    <div className="progress-track" role="progressbar" aria-valuenow={bounded} aria-valuemin="0" aria-valuemax="100">
      <span style={{ width: `${bounded}%`, background: color }} />
    </div>
  </div>
}
