import { formatCurrency } from '../../utils/formatters'
import { getBudgetStatus } from '../../utils/calculations'
import ProgressBar from '../common/ProgressBar'

export default function BudgetCard({ budget, compact = false }) {
  const percentage = (budget.spent / budget.amount) * 100
  const status = getBudgetStatus(percentage)
  return <article className={`budget-card ${compact ? 'compact' : ''}`}>
    <div className="budget-head"><span className="budget-dot" style={{ background: budget.color }}/><div><strong>{budget.name}</strong><span>{budget.method === 'adaptive' ? 'Budget adaptif' : budget.method === 'saving' ? 'Mode menabung' : 'Budget tetap'}</span></div><em className={status.tone}>{status.label}</em></div>
    <ProgressBar value={percentage} color={budget.color}/>
    <div className="budget-numbers"><span>Terpakai <strong>{formatCurrency(budget.spent)}</strong></span><span>Sisa <strong>{formatCurrency(budget.amount-budget.spent)}</strong></span><b>{Math.round(percentage)}%</b></div>
  </article>
}
