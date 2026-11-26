type Props = {
  id: string
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}
export default function AdminTabs({ id, label, value, options, onChange }: Props) {
  return (
    <div className="admin-view-tabs" role="tablist" aria-label={label}>
      {options.map((option, index) => (
        <button
          key={option.value}
          id={`${id}-${option.value}`}
          role="tab"
          aria-selected={value === option.value}
          aria-controls={`${id}-panel`}
          tabIndex={value === option.value ? 0 : -1}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => {
            let next = index
            if (event.key === 'ArrowRight') next = (index + 1) % options.length
            else if (event.key === 'ArrowLeft') next = (index - 1 + options.length) % options.length
            else if (event.key === 'Home') next = 0
            else if (event.key === 'End') next = options.length - 1
            else return
            event.preventDefault()
            onChange(options[next].value)
            document.getElementById(`${id}-${options[next].value}`)?.focus()
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
