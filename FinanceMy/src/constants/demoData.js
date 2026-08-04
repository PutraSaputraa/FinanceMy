export const demoAccounts = [
  { id: 'bsi', name: 'BSI', type: 'Rekening bank', initialBalance: 5000000, currentBalance: 4500000, color: '#087f5b', icon: 'landmark', isActive: true },
  { id: 'blu', name: 'Blu', type: 'Tabungan', initialBalance: 3000000, currentBalance: 3000000, color: '#2271b3', icon: 'piggy-bank', isActive: true },
  { id: 'gopay', name: 'GoPay', type: 'E-wallet', initialBalance: 250000, currentBalance: 350000, color: '#635bff', icon: 'wallet-cards', isActive: true },
  { id: 'cash', name: 'Tunai', type: 'Uang tunai', initialBalance: 300000, currentBalance: 200000, color: '#e08a17', icon: 'banknote', isActive: true },
]

export const demoTransactions = [
  { id: 't1', title: 'Gaji bulanan', category: 'Gaji', account: 'BSI', type: 'income', amount: 6000000, date: '2026-08-01', needType: 'wajib' },
  { id: 't2', title: 'Belanja supermarket', category: 'Kebutuhan Rumah', account: 'BSI', type: 'expense', amount: 482500, date: '2026-08-04', needType: 'kebutuhan' },
  { id: 't3', title: 'Makan siang', category: 'Makan & Minum', account: 'GoPay', type: 'expense', amount: 25000, date: '2026-08-04', needType: 'kebutuhan' },
  { id: 't4', title: 'Transportasi online', category: 'Transportasi', account: 'GoPay', type: 'expense', amount: 18000, date: '2026-08-03', needType: 'kebutuhan' },
  { id: 't5', title: 'WiFi rumah', category: 'Tagihan', account: 'BSI', type: 'expense', amount: 350000, date: '2026-08-02', needType: 'wajib' },
  { id: 't6', title: 'Top up GoPay', category: 'Transfer', account: 'BSI → GoPay', type: 'transfer', amount: 300000, date: '2026-08-02', needType: 'transfer' },
  { id: 't7', title: 'Kopi sore', category: 'Makan & Minum', account: 'Tunai', type: 'expense', amount: 28000, date: '2026-08-01', needType: 'keinginan' },
]

export const demoBudgets = [
  { id: 'b1', name: 'Makan & Minum', amount: 3000000, spent: 1850000, method: 'adaptive', color: '#087f5b' },
  { id: 'b2', name: 'Transportasi', amount: 750000, spent: 652500, method: 'adaptive', color: '#2271b3' },
  { id: 'b3', name: 'Hiburan', amount: 500000, spent: 215000, method: 'saving', color: '#8b5cf6' },
  { id: 'b4', name: 'Langganan', amount: 500000, spent: 500000, method: 'fixed', color: '#e08a17' },
]

export const cashFlowData = [
  { month: 'Mar', income: 5900, expense: 4100, balance: 5600 },
  { month: 'Apr', income: 6200, expense: 4600, balance: 7200 },
  { month: 'Mei', income: 6100, expense: 3900, balance: 9400 },
  { month: 'Jun', income: 6400, expense: 5100, balance: 10700 },
  { month: 'Jul', income: 6000, expense: 4300, balance: 12400 },
  { month: 'Agu', income: 6000, expense: 3100, balance: 15300 },
]

export const categoryData = [
  { name: 'Makan', value: 1850000, color: '#087f5b' },
  { name: 'Tagihan', value: 850000, color: '#2271b3' },
  { name: 'Transportasi', value: 652500, color: '#e08a17' },
  { name: 'Lainnya', value: 447500, color: '#a3a3a3' },
]

export const upcomingBills = [
  { id: 'wifi', title: 'WiFi rumah', date: '2026-08-08', amount: 350000, account: 'BSI', status: '3 hari lagi', tone: 'warning' },
  { id: 'netflix', title: 'Netflix', date: '2026-08-12', amount: 186000, account: 'Blu', status: '7 hari lagi', tone: 'neutral' },
  { id: 'electric', title: 'Listrik', date: '2026-08-15', amount: 425000, account: 'BSI', status: '10 hari lagi', tone: 'neutral' },
]

export const demoGoals = [
  { id: 'goal-emergency', name: 'Dana darurat', target: 30000000, saved: 12600000, deadline: 'Des 2027', color: '#087f5b', priority: 'Prioritas tinggi', icon: 'shield' },
  { id: 'goal-laptop', name: 'Laptop kerja', target: 18000000, saved: 9900000, deadline: 'Feb 2027', color: '#2271b3', priority: 'Prioritas sedang', icon: 'laptop' },
  { id: 'goal-home', name: 'Uang muka rumah', target: 150000000, saved: 32500000, deadline: 'Agu 2030', color: '#8b5cf6', priority: 'Jangka panjang', icon: 'home' },
]

export const demoDebtRecords = {
  utang: [{ id: 'debt-family', name: 'Pinjaman keluarga', total: 5000000, remaining: 2500000, due: '15 Des 2026', monthly: 500000 }],
  piutang: [{ id: 'receivable-dimas', name: 'Dana talangan — Dimas', total: 1200000, remaining: 800000, due: '20 Agu 2026', monthly: 400000 }],
  cicilan: [{ id: 'installment-laptop', name: 'Laptop kerja', total: 20400000, remaining: 11900000, due: '10 tiap bulan', monthly: 850000, cash: 18000000 }],
}
