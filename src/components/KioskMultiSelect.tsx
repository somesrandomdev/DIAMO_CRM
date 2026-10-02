import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { normalizeKiosqueName } from '@/lib/kiosqueImport'

interface KioskOption {
  id: string
  nom: string
  typeCode?: string | null
}

interface KioskMultiSelectProps {
  allKiosques: KioskOption[]
  selectedKiosqueIds: string[]
  onToggle: (kiosqueId: string) => void
  onClear: () => void
  onSelectAll: () => void
}

/**
 * Scalable kiosque filter for 68+ entries: a single button whose label
 * summarizes the selection, opening a searchable checkbox panel. Every
 * toggle applies immediately (no "Appliquer" button).
 */
export function KioskMultiSelect({
  allKiosques,
  selectedKiosqueIds,
  onToggle,
  onClear,
  onSelectAll,
}: KioskMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const sorted = sortedKiosques(allKiosques)
  const needle = normalizeKiosqueName(search)
  const visible = needle
    ? sorted.filter((kiosque) => normalizeKiosqueName(kiosque.nom).includes(needle))
    : sorted

  const label =
    selectedKiosqueIds.length === 0
      ? 'Tous les kiosques'
      : selectedKiosqueIds.length === 1
        ? `1 kiosque : ${allKiosques.find((k) => k.id === selectedKiosqueIds[0])?.nom ?? 'inconnu'}`
        : `${selectedKiosqueIds.length} kiosques sélectionnés`

  return (
    <div ref={containerRef} className="relative w-full sm:w-auto">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 text-xs font-semibold text-text hover:border-primary sm:w-auto sm:min-w-56"
      >
        <span className="truncate">{label}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 z-30 mt-1 rounded-md border-2 border-border bg-white shadow-lg sm:right-auto sm:w-72">
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary"
                aria-hidden="true"
              />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher un kiosque..."
                aria-label="Rechercher un kiosque"
                className="h-10 w-full rounded-md border border-border pl-8 pr-3 text-sm text-text placeholder:text-text-tertiary focus:border-blue focus:outline-none"
              />
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={onSelectAll}
                className="min-h-9 flex-1 rounded-md border border-border text-xs font-semibold text-text-secondary hover:border-blue hover:text-blue"
              >
                Tout
              </button>
              <button
                type="button"
                onClick={onClear}
                className="min-h-9 flex-1 rounded-md border border-border text-xs font-semibold text-text-secondary hover:border-blue hover:text-blue"
              >
                Aucun
              </button>
            </div>
          </div>

          <div
            className="max-h-[320px] overflow-y-auto p-1"
            role="listbox"
            aria-label="Kiosques"
          >
            {visible.length === 0 ? (
              <p className="p-3 text-center text-xs text-text-secondary">Aucun kiosque trouvé</p>
            ) : (
              visible.map((kiosque) => {
                const checked = selectedKiosqueIds.includes(kiosque.id)
                return (
                  <label
                    key={kiosque.id}
                    className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md px-2 hover:bg-bg"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(kiosque.id)}
                      className="h-4 w-4"
                    />
                    <span className="truncate text-sm text-text">
                      {kiosque.typeCode ? (
                        <span className="mr-1.5 inline-block rounded bg-bg px-1 text-xs font-bold text-text-secondary">
                          {kiosque.typeCode}
                        </span>
                      ) : null}
                      {kiosque.nom}
                    </span>
                    {checked && (
                      <Check className="ml-auto h-4 w-4 shrink-0 text-blue" aria-hidden="true" />
                    )}
                  </label>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function sortedKiosques(kiosques: KioskOption[]) {
  return [...kiosques].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
}
