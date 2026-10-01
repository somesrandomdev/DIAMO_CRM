import { memo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CardDescription } from '@/components/ui/card'
import type { DailyRevenuePoint } from '@/components/dashboard/useAdminDashboard'
import { chartTheme } from '@/lib/chartTheme'
import { formatCFACompact, toCFA } from '@/utils/price'

interface DailyTrendChartProps {
  data: DailyRevenuePoint[]
}

interface TooltipEntry {
  dataKey?: string | number
  value?: number | string
  payload?: DailyRevenuePoint
}

/**
 * Plain-French tooltip. Recharts' default shows raw keys ("ca", "moyenne7j"),
 * which mean nothing to a kiosk manager, so both series are relabelled and the
 * date is spelled out in full.
 */
function TrendTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: TooltipEntry[]
}) {
  if (!active || !payload?.length) return null

  const point = payload[0]?.payload
  if (!point) return null

  const fullDate = new Date(`${point.date}T00:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold capitalize text-text">{fullDate}</p>
      <p className="mt-1 flex items-center gap-2 text-sm text-text">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: chartTheme.blue }}
          aria-hidden="true"
        />
        Recette du jour
        <span className="ml-auto font-mono font-semibold">{toCFA(point.ca)}</span>
      </p>
      <p className="mt-0.5 flex items-center gap-2 text-xs text-text-secondary">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: chartTheme.amber }}
          aria-hidden="true"
        />
        Moyenne 7 jours
        <span className="ml-auto font-mono">{toCFA(point.moyenne7j)}</span>
      </p>
    </div>
  )
}

/**
 * 30-day revenue trend.
 *
 * A filled area (not a bare line) makes the "how much" readable at a glance,
 * and the dashed 7-day average gives the eye a baseline so a single good or bad
 * day doesn't read as a trend.
 */
export const DailyTrendChart = memo(function DailyTrendChart({ data }: DailyTrendChartProps) {
  const hasData = data.some((point) => point.ca > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Recettes des 30 derniers jours</CardTitle>
        <CardDescription>
          La ligne pleine est la recette de chaque jour. La ligne en pointillés est la
          moyenne des 7 derniers jours.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
              <defs>
                <linearGradient id="caGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartTheme.blue} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={chartTheme.blue} stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                minTickGap={24}
                tickLine={false}
                axisLine={{ stroke: chartTheme.grid }}
                tick={{ fill: chartTheme.axis, fontSize: 11 }}
              />
              <YAxis
                tickFormatter={formatCFACompact}
                width={52}
                tickLine={false}
                axisLine={false}
                tick={{ fill: chartTheme.axis, fontSize: 11 }}
              />
              <Tooltip content={<TrendTooltip />} />
              <Legend
                verticalAlign="top"
                height={32}
                iconType="plainline"
                wrapperStyle={{ fontSize: 12 }}
              />

              <Area
                type="monotone"
                dataKey="ca"
                name="Recette du jour"
                stroke={chartTheme.blue}
                strokeWidth={2.5}
                fill="url(#caGradient)"
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey="moyenne7j"
                name="Moyenne 7 jours"
                stroke={chartTheme.amber}
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[300px] flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm font-medium text-text">Aucune vente sur les 30 derniers jours</p>
            <p className="max-w-xs text-xs text-text-secondary">
              Le graphique s'affichera automatiquement dès la première vente enregistrée.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
})
