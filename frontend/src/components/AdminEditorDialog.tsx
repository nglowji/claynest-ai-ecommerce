import { useEffect, useRef, type ReactNode } from 'react'

export default function AdminEditorDialog({
  titleId = 'catalog-editor-title',
  className = '',
  children,
  busy,
  error,
  notice,
  onClose,
}: {
  titleId?: string
  className?: string
  children: ReactNode
  busy: boolean
  error: string
  notice: string
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.current?.showModal()
    return () => {
      document.body.style.overflow = previous
    }
  }, [])
  return (
    <dialog
      ref={dialog}
      className={'admin-editor-dialog ' + className}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
    >
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="auth-success">
          {notice}
        </p>
      )}
      {children}
    </dialog>
  )
}
