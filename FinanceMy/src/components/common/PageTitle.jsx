export default function PageTitle({ eyebrow, title, subtitle, action }) {
  return <div className="page-title">
    <div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
    {action}
  </div>
}
