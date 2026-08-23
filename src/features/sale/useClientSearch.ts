import { useEffect, useRef, useState } from 'react'
import type { Client } from '@/stores/venteStore'

/**
 * Client search field logic: filter by name (case-insensitive) or phone,
 * top 10 suggestions, close on outside click. Selection semantics live with
 * the caller; this hook only manages query/results/visibility.
 */
export function useClientSearch(clients: Client[], resetKey: number) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Client[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // After the parent completes a sale it resets the form; the search field
  // returns to its empty state as part of that reset.
  useEffect(() => {
    if (resetKey === 0) return
    setQuery('')
    setResults([])
    setShowSuggestions(false)
  }, [resetKey])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSearch = (value: string) => {
    setQuery(value)

    if (value.trim().length === 0) {
      setResults([])
      setShowSuggestions(false)
      return
    }

    const filtered = clients
      .filter(
        (client) =>
          client.nom.toLowerCase().includes(value.toLowerCase()) ||
          (client.telephone && client.telephone.includes(value))
      )
      .slice(0, 10)

    setResults(filtered)
    setShowSuggestions(filtered.length > 0)
  }

  const closeSuggestions = (client: Client) => {
    setQuery(client.nom)
    setShowSuggestions(false)
  }

  const clearField = () => {
    setQuery('')
    setResults([])
    setShowSuggestions(false)
  }

  const reopenSuggestions = () => {
    if (query) setShowSuggestions(true)
  }

  return {
    query,
    results,
    showSuggestions,
    containerRef,
    handleSearch,
    closeSuggestions,
    clearField,
    reopenSuggestions,
  }
}
