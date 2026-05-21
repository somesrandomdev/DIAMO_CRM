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
import { toCFA } from '@/utils/price'

interface EvolutionLineChartProps {
  data: DailyRevenuePoint[]
}

export function EvolutionLineChart({ data }: EvolutionLineChartProps) {
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle>Evolution quotidienne du reseau</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" minTickGap={18} />
            <YAxis tickFormatter={(value) => toCFA(Number(value))} width={82} />
            <Tooltip formatter={(value) => [toCFA(Number(value)), 'CA']} />
            <Bar dataKey="ca" fill="var(--color-secondary)" radius={[6, 6, 0, 0]} />
            <Line
              type="monotone"
              dataKey="moyenne7j"
              stroke="var(--color-primary)"
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
