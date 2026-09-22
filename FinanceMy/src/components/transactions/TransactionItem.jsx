import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Banknote, Car, Coffee, House, Pencil, Scale, ShoppingBag, Trash2, Wifi } from 'lucide-react'
import { formatCurrency, formatDate } from '../../utils/formatters'

const categoryIcons = { Gaji: Banknote, 'Makan & Minum': Coffee, Transportasi: Car, Tagihan: Wifi, 'Kebutuhan Rumah': ShoppingBag, Transfer: ArrowLeftRight }

export default function TransactionItem({ transaction, budgetName, onEdit, onDelete }) {
  const Icon = transaction.type === 'adjustment' ? Scale : categoryIcons[transaction.category] || House
  const prefix = transaction.type === 'adjustment'
    ? (transaction.adjustmentDelta >= 0 ? '+' : '−')
    : transaction.type === 'income' || transaction.type === 'refund' ? '+' : transaction.type === 'transfer' ? '' : '−'
  const label = transaction.type === 'adjustment' ? 'Penyesuaian' : transaction.type === 'income' ? 'Pemasukan' : transaction.type === 'refund' ? 'Refund' : transaction.type === 'transfer' ? 'Transfer' : 'Pengeluaran'
  const DirectionIcon = transaction.type === 'adjustment' ? Scale : transaction.type === 'income' || transaction.type === 'refund' ? ArrowDownLeft : transaction.type === 'transfer' ? ArrowLeftRight : ArrowUpRight

  return <div className="transaction-item">
    <div className={`transaction-icon ${transaction.type}`}><Icon size={19}/></div>
    <div className="transaction-main"><strong>{transaction.title}</strong><span>{transaction.category} <i/> {transaction.account}{transaction.type === 'transfer' && transaction.destinationAccountName ? ` → ${transaction.destinationAccountName}` : transaction.type === 'transfer' && transaction.destinationAccount ? ` → ${transaction.destinationAccount}` : ''}{budgetName && <> <i/> Budget: {budgetName}</>}</span></div>
    <div className="transaction-date">{formatDate(transaction.date, 'd MMM yyyy')}</div>
    <div className={`transaction-amount ${transaction.type}`}><strong>{prefix}{formatCurrency(transaction.amount)}</strong><span><DirectionIcon/>{label}</span></div>
    {(onEdit || onDelete) && <div className="transaction-actions">
      {onEdit && transaction.type !== 'adjustment' && <button type="button" onClick={() => onEdit(transaction)} aria-label={`Edit transaksi ${transaction.title}`} title="Edit transaksi"><Pencil size={15}/></button>}
      {onDelete && <button type="button" className="delete" onClick={() => onDelete(transaction)} aria-label={`Hapus transaksi ${transaction.title}`} title="Hapus transaksi"><Trash2 size={15}/></button>}
    </div>}
  </div>
}
