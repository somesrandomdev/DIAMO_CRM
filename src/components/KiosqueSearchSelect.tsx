import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { normalizeKiosqueName } from '@/lib/kiosqueImport'

interface KiosqueOption {
  id: string
  nom: string
}

interface KiosqueSearchSelectProps {
  id?: string
  kiosques: KiosqueOption[]
  value: string
  onChange: (kiosqueId: string) => void
  /** Label of the empty choice, e.g. "Aucun (accès global)". */
  emptyLabel?: string
  required?: boolean
  invalid?: boolean
}

/**
 * Single-select kiosque picker with built-in search — scales to 68+ entries
 * where a plain <select> becomes impracticable. Click to open, type to
 * filter, click a name to choose.
 */
export function KiosqueSearchSelect({
  id,
  kiosques,
  value,
  onChange,
  emptyLabel,
  required = false,
  invalid = false,
}: KiosqueSearchSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const sorted = useMemo(
    () => [...kiosques].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
    [kiosques]
  )
  const needle = normalizeKiosqueName(search)
  const visible = needle
    ? sorted.filter((kiosque) => normalizeKiosqueName(kiosque.nom).includes(needle))
    : sorted

  const selectedNom = kiosques.find((kiosque) => kiosque.id === value)?.nom

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const choose = (kiosqueId: string) => {
    onChange(kiosqueId)
    setOpen(false)
    setSearch('')
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        onClick={() => setOpen((current) => !current)}
        className={`flex min-h-12 w-full items-center justify-between gap-2 rounded-md border-2 px-3 text-left text-[15px] transition-colors focus:outline-none ${
          invalid ? 'border-[#FF4949]' : 'border-[#DCE1E5]'
        } ${open ? 'border-[#12364D]' : 'hover:border-[#8AA3B5]'}`}
      >
        <span className={`truncate ${selectedNom ? 'text-[#12364D]' : 'text-[#8AA3B5]'}`}>
          {selectedNom ?? emptyLabel ?? 'Choisir un kiosque...'}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#8AA3B5] transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 rounded-md border-2 border-[#DCE1E5] bg-white shadow-lg">
          <div className="border-b border-[#DCE1E5] p-2">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8AA3B5]"
                aria-hidden="true"
              />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher..."
                aria-label="Rechercher un kiosque"
                className="h-10 w-full rounded-md border border-[#DCE1E5] pl-8 pr-3 text-[13px] text-[#12364D] placeholder:text-[#8AA3B5] focus:border-[#009EFB] focus:outline-none"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-[320px] overflow-y-auto p-1" role="listbox">
            {!required && (
              <button
                type="button"
                role="option"
                aria-selected={value === ''}
                onClick={() => choose('')}
                className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-[#F6F9FB]"
              >
                <span className="text-[13px] text-[#1C5376]">
                  {emptyLabel ?? 'Aucun'}
                </span>
                {value === '' && (
                  <Check className="ml-auto h-4 w-4 text-[#009EFB]" aria-hidden="true" />
                )}
              </button>
            )}
            {visible.map((kiosque) => (
              <button
                key={kiosque.id}
                type="button"
                role="option"
                aria-selected={value === kiosque.id}
                onClick={() => choose(kiosque.id)}
                className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-[#F6F9FB]"
              >
                <span className="truncate text-[13px] text-[#12364D]">{kiosque.nom}</span>
                {value === kiosque.id && (
                  <Check className="ml-auto h-4 w-4 shrink-0 text-[#009EFB]" aria-hidden="true" />
                )}
              </button>
            ))}
            {visible.length === 0 && (
              <p className="p-3 text-center text-xs text-[#1C5376]">Aucun kiosque trouvé</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
