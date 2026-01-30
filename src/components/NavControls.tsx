import { useAuthStore } from '../stores/authStore'

export function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      onClick={onBack}
      className="inline-flex items-center px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 font-medium"
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
      className="inline-flex items-center px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 font-medium"
    >
      Déconnexion
    </button>
  )
}