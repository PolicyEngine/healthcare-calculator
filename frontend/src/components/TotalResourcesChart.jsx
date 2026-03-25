import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

function TotalResourcesChart({ data, currentIncome, fpgMonthly }) {
  const formatCurrency = (value) => `$${value.toLocaleString()}`

  // Y-axis must include the FPL line and the max stacked value
  const yDomain = useMemo(() => {
    if (!data || data.length === 0) return [0, 1000]
    const maxStacked = Math.max(...data.map(d => d.total_income_monthly + d.tanf_monthly))
    const ceiling = Math.max(maxStacked, fpgMonthly || 0) * 1.1
    // Round up to a nice number
    const step = ceiling > 3000 ? 1000 : ceiling > 1000 ? 500 : 250
    return [0, Math.ceil(ceiling / step) * step]
  }, [data, fpgMonthly])

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload
      const totalResources = point.total_income_monthly + point.tanf_monthly
      return (
        <div style={{
          background: '#1a2744',
          padding: '16px 20px',
          borderRadius: '8px',
          boxShadow: '0 12px 32px rgba(26, 39, 68, 0.25)',
          color: 'white',
          fontFamily: "'Inter', sans-serif",
        }}>
          <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.7, marginBottom: '8px' }}>
            At {formatCurrency(label)}/mo income
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#1E293B', flexShrink: 0 }} />
            <span style={{ fontSize: '0.85rem' }}>Income: {formatCurrency(point.total_income_monthly)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#319795', flexShrink: 0 }} />
            <span style={{ fontSize: '0.85rem' }}>TANF: {formatCurrency(point.tanf_monthly)}</span>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.125rem', fontWeight: 700, color: '#4FD1C5' }}>
              Total: {formatCurrency(totalResources)}/mo
            </span>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="chart-wrapper">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e2dd" />
          <XAxis
            dataKey="total_income_monthly"
            type="number"
            domain={[0, 'dataMax']}
            tickFormatter={(v) => `$${v.toLocaleString()}`}
            label={{ value: 'Monthly household income', position: 'bottom', offset: -5, fill: '#6b7280', fontSize: 12 }}
            tick={{ fill: '#6b7280', fontSize: 12 }}
            axisLine={{ stroke: '#e5e2dd' }}
            tickLine={{ stroke: '#e5e2dd' }}
          />
          <YAxis
            type="number"
            domain={yDomain}
            allowDecimals={false}
            tickFormatter={(v) => `$${v.toLocaleString()}`}
            label={{ value: 'Income + TANF ($/mo)', angle: -90, position: 'insideLeft', dx: -5, style: { textAnchor: 'middle', fill: '#6b7280', fontSize: 11 } }}
            tick={{ fill: '#6b7280', fontSize: 11 }}
            axisLine={{ stroke: '#e5e2dd' }}
            tickLine={{ stroke: '#e5e2dd' }}
          />
          <Tooltip content={<CustomTooltip />} />
          {fpgMonthly && (
            <ReferenceLine
              y={fpgMonthly}
              stroke="#EF4444"
              strokeDasharray="6 4"
              strokeWidth={2}
            />
          )}
          {currentIncome != null && (
            <ReferenceLine
              x={currentIncome}
              stroke="#64748B"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
          )}
          <Area
            type="monotone"
            dataKey="total_income_monthly"
            stackId="1"
            stroke="#1E293B"
            fill="#1E293B"
            fillOpacity={0.15}
          />
          <Area
            type="monotone"
            dataKey="tanf_monthly"
            stackId="1"
            stroke="#319795"
            fill="#319795"
            fillOpacity={0.4}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default TotalResourcesChart
