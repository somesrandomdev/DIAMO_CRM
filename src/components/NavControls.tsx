import { memo } from 'react'
import { ArrowLeft, LogOut } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'

interface BackButtonProps {
  onBack: () => void
}

export const BackButton = memo(function BackButton({ onBack }: BackButtonProps) {
  return (
    <Button
      variant="secondary"
      onClick={onBack}
      className="gap-2"
    >
      <ArrowLeft className="h-4 w-4" />
      Retour
    </Button>
  )
})

export const LogoutButton = memo(function LogoutButton() {
  const { signOut } = useAuthStore()

  const handleClick = async (): Promise<void> => {
    try {
      await signOut()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <Button
      variant="destructive"
      onClick={handleClick}
      className="gap-2"
    >
      <LogOut className="h-4 w-4" />
      Déconnexion
    </Button>
  )
})
