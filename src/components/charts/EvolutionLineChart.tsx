import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DailyRevenuePoint } from '@/components/dashboard/useAdminDashboard'
import { chartTheme } from '@/lib/chartTheme'
import { toCFA } from '@/utils/price'

interface EvolutionLineChartProps {
  data: DailyRevenuePoint[]
}

export function EvolutionLineChart({ data }: EvolutionLineChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolution quotidienne du reseau</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
            <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" minTickGap={18} tick={{ fill: chartTheme.axis, fontSize: 11 }} />
            <YAxis tickFormatter={(value) => toCFA(Number(value))} width={82} tick={{ fill: chartTheme.axis, fontSize: 11 }} />
            <Tooltip contentStyle={chartTheme.tooltip} formatter={(value) => [toCFA(Number(value)), 'CA']} />
            <Bar dataKey="ca" fill={chartTheme.teal} radius={[6, 6, 0, 0]} />
            <Line
              type="monotone"
              dataKey="moyenne7j"
              stroke={chartTheme.blue}
              strokeDasharray="6 4"
              strokeWidth={3}
              dot={false}
              name="Moyenne 7j"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
