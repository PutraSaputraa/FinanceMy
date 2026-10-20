import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export default function ExplainerCard({ title, className = '', children }) {
  const [expanded, setExpanded] = useState(false)
  const contentId = useId()
  return <section className={`card explainer-card ${className}${expanded ? ' is-expanded' : ''}`} aria-label={title}>
    <strong>{title}</strong>
    <button type="button" className="explainer-toggle" aria-expanded={expanded} aria-controls={contentId} onClick={() => setExpanded(!expanded)}>{expanded ? 'Tutup panduan' : 'Lihat panduan'}<ChevronDown size={15}/></button>
    <div className="explainer-content" id={contentId}>{children}</div>
  </section>
}
