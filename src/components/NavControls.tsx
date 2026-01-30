import { useAuthStore } from '../stores/authStore'

export function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      onClick={onBack}
      className="btn btn-neutral"
    >
      ← Retour
    </button>
  )
}

export function LogoutButton() {
  const { signOut } = useAuthStore()

  const handleClick = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <button
      onClick={handleClick}
      className="btn btn-danger"
    >
      Déconnexion
    </button>
  )
}