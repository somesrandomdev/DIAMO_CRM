import { Search, X } from 'lucide-react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** When provided, renders "X résultat(s) trouvé(s)" under the field. */
  resultCount?: number
  label?: string
}

/**
 * The one search field used by every list view: 48px target, brand borders,
 * clear button, optional result count so users know the filter worked.
 */
export function SearchBar({ value, onChange, placeholder, resultCount, label }: SearchBarProps) {
  return (
    <div className="w-full">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#5C7385]"
          aria-hidden="true"
        />
        <input
          data-page-search
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder || 'Rechercher...'}
          aria-label={label || placeholder || 'Rechercher'}
          className="h-12 w-full rounded-lg border-2 border-[#DCE1E5] bg-white pl-10 pr-10 text-base text-[#12364D] placeholder:text-[#8AA3B5] focus:border-[#006EBD] focus:outline-none focus:ring-0"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-[#5C7385] transition-colors hover:bg-[#F6F9FB] hover:text-[#12364D]"
            aria-label="Effacer la recherche"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {resultCount !== undefined && (
        <p className="mt-1 text-sm text-[#1C5376] [font-variant-numeric:tabular-nums]">
          {resultCount} résultat{resultCount !== 1 ? 's' : ''} trouvé{resultCount !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}
