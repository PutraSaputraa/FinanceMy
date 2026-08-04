import { CheckCircle2, AlertTriangle } from 'lucide-react'
export default function Toast({ toast }) {
  if (!toast) return null
  return <div className={`toast ${toast.tone}`} role="status">
    {toast.tone === 'danger' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />} {toast.message}
  </div>
}
