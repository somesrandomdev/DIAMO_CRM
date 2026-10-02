import { useNavigate } from 'react-router-dom'
import { LockKeyhole } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuthStore } from '@/stores/authStore'
import { getRoleHome } from '@/utils/roleRoutes'

export default function UnauthorizedPage() {
  const navigate = useNavigate()
  const { profile } = useAuthStore()

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center space-y-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-light">
            <LockKeyhole className="h-7 w-7 text-red" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-text">Accès non autorisé</h1>
            <p className="mt-2 text-xs text-text-secondary">
              Votre rôle ne permet pas d'ouvrir cette page.
            </p>
          </div>
          <Button variant="primary" onClick={() => navigate(getRoleHome(profile?.role), { replace: true })}>
            Retour a mon espace
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
