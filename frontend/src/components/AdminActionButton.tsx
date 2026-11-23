import type { ButtonHTMLAttributes } from 'react'
import AdminIcon, { type AdminIconName } from './AdminIcon'

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  icon: AdminIconName
  label: string
  danger?: boolean
}
export default function AdminActionButton({
  icon,
  label,
  danger,
  className = '',
  ...props
}: Props) {
  return (
    <button
      {...props}
      type="button"
      className={`admin-action-button ${danger ? 'is-danger' : ''} ${className}`}
      aria-label={label}
      title={label}
    >
      <AdminIcon name={icon} />
    </button>
  )
}
