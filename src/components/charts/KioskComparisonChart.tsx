import { memo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { KiosquePerformance } from '@/components/dashboard/useAdminDashboard'
import { chartTheme } from '@/lib/chartTheme'
import { formatCFACompact, formatCount, toCFA } from '@/utils/price'

interface KioskComparisonChartProps {
  data: KiosquePerformance[]
  onBarClick?: (id: string) => void
  /** Hidden when showing last month, where per-kiosk deltas aren't available. */
  showDelta?: boolean
}

interface BarTooltipProps {
  active?: boolean
  payload?: { payload?: KiosquePerformance }[]
  showDelta?: boolean
  clickable?: boolean
}

function BarTooltip({ active, payload, showDelta, clickable }: BarTooltipProps) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (!row) return null

  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 shadow-lg">
      <p className="text-sm font-semibold text-text">{row.nom}</p>
      <p className="mt-1 flex items-baseline gap-3 text-xs text-text-secondary">
        Recette du mois
        <span className="ml-auto font-mono text-sm font-semibold text-text">
          {toCFA(row.caMois)}
        </span>
      </p>
      {row.nbVentes > 0 && (
        <>
          <p className="flex items-baseline gap-3 text-xs text-text-secondary">
            Ventes
            <span className="ml-auto font-mono text-text">{formatCount(row.nbVentes)}</span>
          </p>
          <p className="flex items-baseline gap-3 text-xs text-text-secondary">
            Panier moyen
            <span className="ml-auto font-mono text-text">{toCFA(row.panierMoyen)}</span>
          </p>
        </>
      )}
      {showDelta && (
        <p className="mt-1 border-t border-border pt-1 text-xs text-text-secondary">
          {row.deltaVsPrevious > 0 ? '+' : ''}
          {row.deltaVsPrevious.toFixed(1)} % vs mois dernier
        </p>
      )}
      {clickable && (
        <p className="mt-1.5 text-xs italic text-text-tertiary">
          Touchez la barre pour voir le détail
        </p>
      )}
    </div>
  )
}

/**
 * Revenue per kiosk for the selected month.
 *
 * Horizontal layout: kiosk names are words, not dates, and a vertical bar chart
 * forces them to -30° rotation where they become hard to read on a phone.
 * Horizontal bars keep every label flat and left-aligned.
 *
 * The top performer is tinted teal so the winner is identifiable without
 * reading any numbers.
 */
export const KioskComparisonChart = memo(function KioskComparisonChart({
  data,
  onBarClick,
  showDelta = true,
}: KioskComparisonChartProps) {
  // Drop zero-revenue kiosks: a row of empty bars adds height without meaning.
  const rows = data.filter((row) => row.caMois > 0)
  const best = rows[0]?.caMois ?? 0

  // Give each bar a fixed slice of vertical space so 3 kiosks aren't stretched
  // to fill 300px and 15 aren't crushed into it.
  const chartHeight = Math.max(220, Math.min(rows.length * 44 + 40, 620))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Comparaison des kiosques</CardTitle>
        <CardDescription>
          Recette totale du mois, du plus élevé au plus faible.
          {onBarClick ? ' Touchez une barre pour ouvrir la fiche du kiosque.' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length > 0 ? (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ top: 4, right: 56, left: 4, bottom: 4 }}
              barCategoryGap="22%"
            >
              <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={formatCFACompact}
                tickLine={false}
                axisLine={false}
                tick={{ fill: chartTheme.axis, fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="nom"
                width={110}
                tickLine={false}
                axisLine={false}
                tick={{ fill: chartTheme.axis, fontSize: 12 }}
              />
              <Tooltip
                content={<BarTooltip showDelta={showDelta} clickable={!!onBarClick} />}
                cursor={{ fill: 'var(--color-muted)', opacity: 0.6 }}
              />
              <Bar
                dataKey="caMois"
                radius={[0, 6, 6, 0]}
                cursor={onBarClick ? 'pointer' : 'default'}
                onClick={(row: unknown) => {
                  const id = (row as KiosquePerformance | undefined)?.id
                  if (onBarClick && id) onBarClick(id)
                }}
              >
                {rows.map((row) => (
                  <Cell
                    key={row.id}
                    fill={row.caMois === best ? chartTheme.teal : chartTheme.blue}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm font-medium text-text">Aucune recette ce mois</p>
            <p className="max-w-xs text-xs text-text-secondary">
              Les kiosques apparaîtront ici dès qu'une vente sera enregistrée.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
})
