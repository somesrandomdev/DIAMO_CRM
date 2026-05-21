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
    <div className="min-h-[60vh] flex items-center justify-center">
      <Card className="w-full max-w-md rounded-lg">
        <CardContent className="pt-6 text-center space-y-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <LockKeyhole className="h-7 w-7 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Acces non autorise</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Votre role ne permet pas d'ouvrir cette page.
            </p>
          </div>
          <Button onClick={() => navigate(getRoleHome(profile?.role), { replace: true })}>
            Retour a mon espace
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
