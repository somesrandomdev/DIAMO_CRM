import { Button } from '@/components/ui/button'

interface LoadMoreButtonProps {
  shown: number
  total: number
  isLoading: boolean
  onClick: () => void
  /** "clients", "kiosques"… */
  noun: string
}

/** "Afficher plus" under a server-paged list; hidden once everything is shown. */
export function LoadMoreButton({ shown, total, isLoading, onClick, noun }: LoadMoreButtonProps) {
  if (shown >= total) return null
  return (
    <Button
      type="button"
      variant="outline"
      size="touch"
      className="w-full"
      loading={isLoading}
      loadingText="Chargement…"
      onClick={onClick}
    >
      Afficher plus — {shown} sur {total} {noun}
    </Button>
  )
}
