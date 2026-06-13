import { Badge } from '@/components/ui/badge'
import { AlertCard } from '@/components/ui/alert-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useAlerts } from '@/components/dashboard/useAlerts'

export function AlertsPanel() {
  const { alerts, isLoading, error } = useAlerts()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Alertes</CardTitle>
          {alerts.length > 0 && <Badge variant="outline">{alerts.length}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          [1, 2, 3].map((item) => <Skeleton key={item} className="h-16 w-full rounded-lg" />)
        ) : alerts.length > 0 ? (
          alerts.map((alert, index) => (
            <AlertCard
              key={`${alert.type}-${alert.kiosque_nom}-${index}`}
              severity={alert.severity}
              title={alert.kiosque_nom}
              subtitle={alert.message}
            />
          ))
        ) : (
          <EmptyState title="Aucune alerte active" className="border-0 bg-muted p-4" />
        )}
        {error && <p className="text-xs text-text-secondary">{error}</p>}
      </CardContent>
    </Card>
  )
}
