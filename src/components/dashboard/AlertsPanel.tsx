import { AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAlerts, type AdminAlertSeverity } from '@/components/dashboard/useAlerts'
import { cn } from '@/lib/utils'

function severityIcon(severity: AdminAlertSeverity) {
  if (severity === 'danger') return <AlertCircle className="h-4 w-4" />
  if (severity === 'warning') return <AlertTriangle className="h-4 w-4" />
  return <Info className="h-4 w-4" />
}

function severityClasses(severity: AdminAlertSeverity) {
  if (severity === 'danger') return 'border-destructive/30 bg-destructive/10 text-destructive'
  if (severity === 'warning') return 'border-warning/40 bg-warning/15 text-foreground'
  return 'border-primary/25 bg-primary/10 text-primary'
}

export function AlertsPanel() {
  const { alerts, isLoading, error } = useAlerts()

  return (
    <Card className="rounded-lg">
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
            <div
              key={`${alert.type}-${alert.kiosque_nom}-${index}`}
              className={cn('rounded-lg border p-3', severityClasses(alert.severity))}
            >
              <div className="flex items-start gap-2">
                <div className="mt-0.5">{severityIcon(alert.severity)}</div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{alert.kiosque_nom}</p>
                  <p className="text-sm opacity-85">{alert.message}</p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Aucune alerte active.</p>
        )}
        {error && <p className="text-xs text-muted-foreground">{error}</p>}
      </CardContent>
    </Card>
  )
}
