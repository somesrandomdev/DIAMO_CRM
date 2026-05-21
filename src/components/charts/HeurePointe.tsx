import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { HourlySalesPoint } from '@/components/dashboard/useAdminDashboard'

interface HeurePointeProps {
  data: HourlySalesPoint[]
}

export function HeurePointe({ data }: HeurePointeProps) {
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle>Heures de pointe reseau</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="hour" />
            <YAxis allowDecimals={false} />
            <Tooltip formatter={(value) => [value, 'Ventes']} />
            <Bar dataKey="ventes" fill="var(--color-success)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
