import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { KiosquePerformance } from '@/components/dashboard/useAdminDashboard'
import { chartTheme } from '@/lib/chartTheme'
import { toCFA } from '@/utils/price'

interface CABarChartProps {
  data: KiosquePerformance[]
  onBarClick?: (id: string) => void
}

export function CABarChart({ data, onBarClick }: CABarChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>CA par kiosque</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 48 }}>
            <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="nom" angle={-30} textAnchor="end" interval={0} height={70} tick={{ fill: chartTheme.axis, fontSize: 11 }} />
            <YAxis tickFormatter={(value) => toCFA(Number(value))} width={82} tick={{ fill: chartTheme.axis, fontSize: 11 }} />
            <Tooltip contentStyle={chartTheme.tooltip} formatter={(value) => [toCFA(Number(value)), 'CA']} />
            <Bar
              dataKey="caMois"
              fill={chartTheme.blue}
              radius={[6, 6, 0, 0]}
              cursor={onBarClick ? 'pointer' : 'default'}
              onClick={(row) => {
                if (onBarClick && row?.id) onBarClick(row.id)
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
