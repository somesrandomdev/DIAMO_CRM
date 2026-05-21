import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { OfferBreakdownPoint } from '@/components/dashboard/useAdminDashboard'
import { toCFA } from '@/utils/price'

interface OffreDonutProps {
  data: OfferBreakdownPoint[]
}

const COLORS = ['#1C7ED6', '#40C057', '#FFD43B', '#FA5252', '#74C0FC', '#845EF7']

export function OffreDonut({ data }: OffreDonutProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0)

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle>Repartition des ventes par offre</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={58}
              outerRadius={95}
              paddingAngle={2}
            >
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, _name, item) => {
                const amount = Number(value)
                const share = total > 0 ? (amount / total) * 100 : 0
                return [`${toCFA(amount)} (${share.toFixed(1)}%)`, item.name]
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {data.map((item, index) => (
            <div key={item.name} className="flex items-center gap-2 text-sm">
              <span
                className="h-3 w-3 rounded-sm"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="truncate">{item.name}</span>
            </div>
          ))}
          {data.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune vente ce mois.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
