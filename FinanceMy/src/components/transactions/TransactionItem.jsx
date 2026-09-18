import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Banknote, Car, Coffee, House, Scale, ShoppingBag, Wifi } from 'lucide-react'
import { formatCurrency, formatDate } from '../../utils/formatters'

const categoryIcons = { Gaji: Banknote, 'Makan & Minum': Coffee, Transportasi: Car, Tagihan: Wifi, 'Kebutuhan Rumah': ShoppingBag, Transfer: ArrowLeftRight }

export default function TransactionItem({ transaction }) {
  const Icon = transaction.type === 'adjustment' ? Scale : categoryIcons[transaction.category] || House
  const prefix = transaction.type === 'adjustment'
    ? (transaction.adjustmentDelta >= 0 ? '+' : '−')
    : transaction.type === 'income' ? '+' : transaction.type === 'transfer' ? '' : '−'
  const label = transaction.type === 'adjustment' ? 'Penyesuaian' : transaction.type === 'income' ? 'Pemasukan' : transaction.type === 'transfer' ? 'Transfer' : 'Pengeluaran'
  const DirectionIcon = transaction.type === 'adjustment' ? Scale : transaction.type === 'income' ? ArrowDownLeft : transaction.type === 'transfer' ? ArrowLeftRight : ArrowUpRight

  return <div className="transaction-item">
    <div className={`transaction-icon ${transaction.type}`}><Icon size={19}/></div>
    <div className="transaction-main"><strong>{transaction.title}</strong><span>{transaction.category} <i/> {transaction.account}</span></div>
    <div className="transaction-date">{formatDate(transaction.date, 'd MMM yyyy')}</div>
    <div className={`transaction-amount ${transaction.type}`}><strong>{prefix}{formatCurrency(transaction.amount)}</strong><span><DirectionIcon/>{label}</span></div>
  </div>
}
