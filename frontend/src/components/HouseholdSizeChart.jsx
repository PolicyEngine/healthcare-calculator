import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { niceTicks } from '../utils/niceTicks'

const formatCurrency = (value) => value.toLocaleString('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

function HouseholdSizeChart({ data, currentChildren }) {
  const yTicks = useMemo(() => {
    if (!data || data.length === 0) return [0]
    const yMax = Math.max(...data.map((item) => item.support_monthly))
    return niceTicks(yMax)
  }, [data])

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload
      return (
        <div style={{
          background: '#1a2744',
          padding: '12px 16px',
          borderRadius: '8px',
          boxShadow: '0 12px 32px rgba(26, 39, 68, 0.25)',
          color: 'white',
          fontFamily: "'Inter', sans-serif",
        }}>
          <p style={{ fontSize: '0.75rem', letterSpacing: '0.05em', opacity: 0.7, marginBottom: '4px' }}>
            {item.children} {item.children === 1 ? 'child' : 'children'}
          </p>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#4FD1C5' }}>
            {formatCurrency(item.support_monthly)}/mo
          </p>
          {item.children === currentChildren && (
            <p style={{ fontSize: '0.75rem', marginTop: '8px', opacity: 0.7, fontStyle: 'italic' }}>
              Your household
            </p>
          )}
        </div>
      )
    }
    return null
  }

  return (
    <div className="chart-wrapper">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e2dd" vertical={false} />
          <XAxis
            dataKey="children"
            label={{ value: 'Number of children', position: 'bottom', offset: -5, fill: '#6b7280', fontSize: 12 }}
            tick={{ fill: '#6b7280', fontSize: 12 }}
            axisLine={{ stroke: '#e5e2dd' }}
            tickLine={{ stroke: '#e5e2dd' }}
          />
          <YAxis
            domain={[0, yTicks[yTicks.length - 1]]}
            ticks={yTicks}
            tickFormatter={formatCurrency}
            tick={{ fill: '#6b7280', fontSize: 12 }}
            axisLine={{ stroke: '#e5e2dd' }}
            tickLine={{ stroke: '#e5e2dd' }}
          />
          <Tooltip content={<CustomTooltip />} separator=": " cursor={{ fill: 'rgba(13, 148, 136, 0.08)' }} />
          <Bar dataKey="support_monthly" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.children}
                fill={entry.children === currentChildren ? '#EF4444' : '#319795'}
                opacity={entry.children === currentChildren ? 1 : 0.8}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default HouseholdSizeChart
