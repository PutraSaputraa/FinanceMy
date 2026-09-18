import { Trash2 } from 'lucide-react'
import { formatCurrency } from '../../utils/formatters'
import { getBudgetStatus } from '../../utils/calculations'
import ProgressBar from '../common/ProgressBar'

export default function BudgetCard({ budget, compact = false, onDelete }) {
  const percentage = budget.amount ? (budget.spent / budget.amount) * 100 : 0
  const status = getBudgetStatus(percentage)
  const methodLabel = budget.method === 'fixed' || budget.method === 'saving' ? 'Batas harian tetap' : 'Batas harian adaptif'
  return <article className={`budget-card ${compact ? 'compact' : ''}`}>
    <div className="budget-head"><span className="budget-dot" style={{ background: budget.color }}/><div><strong>{budget.name}</strong><span>{methodLabel}</span></div><em className={status.tone}>{status.label}</em>{onDelete && <button className="budget-delete" type="button" onClick={() => onDelete(budget)} aria-label={`Hapus budget ${budget.name}`} title="Hapus budget"><Trash2 size={16}/></button>}</div>
    <ProgressBar value={percentage} color={budget.color}/>
    <div className="budget-numbers"><span>Terpakai <strong>{formatCurrency(budget.spent)}</strong></span><span>Sisa <strong>{formatCurrency(budget.amount-budget.spent)}</strong></span><b>{Math.round(percentage)}%</b></div>
  </article>
}
