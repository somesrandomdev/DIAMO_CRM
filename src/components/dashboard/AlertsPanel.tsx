import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { AlertCard } from '@/components/ui/alert-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useAlerts, type AdminAlert } from '@/components/dashboard/useAlerts'
import { ALERT_RULE_LABELS } from '@/lib/alertScope'

const ALL = 'all'

/** Kiosk alerts open the kiosk page; network-wide offer alerts open Offres. */
function alertHref(alert: AdminAlert): string {
  return alert.kiosque_id ? `/admin/kiosques/${alert.kiosque_id}` : '/admin/offres'
}

export function AlertsPanel() {
  const { alerts, activeKiosques, isLoading, error } = useAlerts()
  const [filter, setFilter] = useState<string>(ALL)

  // One filter per rule present, in the server's severity order.
  const rules = useMemo(() => [...new Set(alerts.map((alert) => alert.type))], [alerts])
  // A refresh can clear the selected rule: fall back to "Toutes".
  const activeFilter = rules.includes(filter) ? filter : ALL
  const visible = activeFilter === ALL ? alerts : alerts.filter((alert) => alert.type === activeFilter)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Alertes</CardTitle>
          {alerts.length > 0 && <Badge variant="outline">{alerts.length}</Badge>}
        </div>
        {activeKiosques !== null && (
          <p className="text-xs text-text-secondary">
            {activeKiosques} {activeKiosques > 1 ? 'kiosques actifs surveillés' : 'kiosque actif surveillé'}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          [1, 2, 3].map((item) => <Skeleton key={item} className="h-16 w-full rounded-lg" />)
        ) : alerts.length > 0 ? (
          <>
            {rules.length > 1 && (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer les alertes">
                {[ALL, ...rules].map((rule) => {
                  const count = rule === ALL ? alerts.length : alerts.filter((alert) => alert.type === rule).length
                  return (
                    <Button
                      key={rule}
                      type="button"
                      variant={activeFilter === rule ? 'primary' : 'outline'}
                      size="sm"
                      aria-pressed={activeFilter === rule}
                      onClick={() => setFilter(rule)}
                    >
                      {rule === ALL ? 'Toutes' : ALERT_RULE_LABELS[rule] ?? rule} ({count})
                    </Button>
                  )
                })}
              </div>
            )}
            <ul className="space-y-3" aria-label="Alertes">
              {visible.map((alert, index) => (
                <li key={`${alert.type}-${alert.kiosque_id ?? alert.kiosque_nom}-${index}`}>
                  <Link
                    to={alertHref(alert)}
                    className="block rounded-md transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <AlertCard severity={alert.severity} title={alert.kiosque_nom} subtitle={alert.message} />
                    <span className="sr-only">
                      {alert.kiosque_id ? ' — ouvrir la fiche kiosque' : ' — ouvrir les offres'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : error ? null : (
          <EmptyState
            title="Aucune alerte — tous les kiosques actifs ont vendu récemment"
            className="border-0 bg-muted p-4"
          />
        )}
        {error && <p className="text-xs text-text-secondary">{error}</p>}
      </CardContent>
    </Card>
  )
}
