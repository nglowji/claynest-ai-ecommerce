import { useEffect, useRef, type ReactNode } from 'react'

export default function AdminEditorDialog({
  children,
  busy,
  error,
  onClose,
}: {
  children: ReactNode
  busy: boolean
  error: string
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
      className="admin-editor-dialog"
      aria-labelledby="catalog-editor-title"
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
      {children}
    </dialog>
  )
}
