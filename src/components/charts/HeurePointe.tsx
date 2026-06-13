import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { HourlySalesPoint } from '@/components/dashboard/useAdminDashboard'
import { chartTheme } from '@/lib/chartTheme'

interface HeurePointeProps {
  data: HourlySalesPoint[]
}

export function HeurePointe({ data }: HeurePointeProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Heures de pointe reseau</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
            <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="hour" tick={{ fill: chartTheme.axis, fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fill: chartTheme.axis, fontSize: 11 }} />
            <Tooltip contentStyle={chartTheme.tooltip} formatter={(value) => [value, 'Ventes']} />
            <Bar dataKey="ventes" fill={chartTheme.green} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
