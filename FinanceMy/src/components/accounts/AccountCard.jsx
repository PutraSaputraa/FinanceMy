import { ArrowUpRight, Banknote, Landmark, PiggyBank, WalletCards } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { formatCurrency } from '../../utils/formatters'

const icons = { 'Rekening bank': Landmark, Tabungan: PiggyBank, 'E-wallet': WalletCards, 'Uang tunai': Banknote }
export default function AccountCard({ account }) {
  const Icon = icons[account.type] || WalletCards
  const { hiddenAmounts } = useTheme()
  return <article className="account-card" style={{ '--account-color': account.color }}>
    <div className="account-icon"><Icon size={20}/></div><div><span>{account.type}</span><strong>{account.name}</strong></div><button aria-label={`Lihat ${account.name}`}><ArrowUpRight size={17}/></button>
    <p>{hiddenAmounts ? 'Rp ••••••••' : formatCurrency(account.currentBalance)}</p>
  </article>
}
