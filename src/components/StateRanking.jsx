import { useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

const DEFAULT_COUNT = 7

const getOrdinal = (value) => {
  const suffixes = ['th', 'st', 'nd', 'rd']
  const mod100 = value % 100
  return value + (suffixes[(mod100 - 20) % 10] || suffixes[mod100] || suffixes[0])
}

function StateRanking({ data, selectedState, onStateSelect }) {
  const [expanded, setExpanded] = useState(true)

  const allEligible = useMemo(() => {
    if (!data) return []
    return data.filter((item) => !item.error && item.support_monthly > 0)
  }, [data])

  const displayStates = expanded ? allEligible : allEligible.slice(0, DEFAULT_COUNT)

  const formatCurrency = (value) => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)

  const selectedStateData = useMemo(() => {
    if (!selectedState) return null
    const index = allEligible.findIndex((item) => item.state === selectedState)
    return index >= 0 ? { ...allEligible[index], rank: index + 1 } : null
  }, [allEligible, selectedState])

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload
      return (
        <div style={{
          background: '#1a2744',
          padding: '12px 16px',
          borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(26, 39, 68, 0.25)',
          color: 'white',
          fontFamily: "'Inter', sans-serif",
        }}>
          <p style={{ fontWeight: 600, marginBottom: '4px' }}>{item.state_name}</p>
          <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#4FD1C5' }}>
            {formatCurrency(item.support_monthly)}/mo
          </p>
          <p style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '4px' }}>
            {formatCurrency(item.support_annual)}/year
          </p>
        </div>
      )
    }

    return null
  }

  if (!data || allEligible.length === 0) {
    return <p className="ranking-empty">No states show modeled assistance for this household.</p>
  }

  return (
    <div className="state-ranking">
      {selectedStateData && (
        <div className="selected-state-rank">
          <span className="rank-badge">#{selectedStateData.rank}</span>
          <span className="rank-text">
            <strong>{selectedStateData.state_name}</strong> provides the {getOrdinal(selectedStateData.rank)} strongest modeled healthcare support for this household
            {' '}
            (<strong>{formatCurrency(selectedStateData.support_monthly)}/mo</strong>)
          </span>
        </div>
      )}

      <div className="ranking-chart">
        <ResponsiveContainer width="100%" height={Math.max(200, displayStates.length * 36)}>
          <BarChart
            data={displayStates}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
            barCategoryGap={6}
          >
            <XAxis
              type="number"
              tickFormatter={(value) => `$${value}`}
              tick={{ fill: '#6b7280', fontSize: 11 }}
              axisLine={{ stroke: '#e5e2dd' }}
              tickLine={{ stroke: '#e5e2dd' }}
            />
            <YAxis
              type="category"
              dataKey="state_name"
              tick={{ fill: '#1a2744', fontSize: 12, fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
              width={75}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(13, 148, 136, 0.08)' }} />
            <Bar
              dataKey="support_monthly"
              radius={[0, 4, 4, 0]}
              onClick={(entry) => onStateSelect(entry.state)}
              style={{ cursor: 'pointer' }}
            >
              {displayStates.map((entry) => (
                <Cell
                  key={entry.state}
                  fill={entry.state === selectedState ? '#EF4444' : '#319795'}
                  opacity={entry.state === selectedState ? 1 : 0.85}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="ranking-footer">
        {allEligible.length > DEFAULT_COUNT && (
          <button className="expand-btn" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Show less' : `Show all ${allEligible.length} states`}
          </button>
        )}
        <p>Click a bar to select that state</p>
      </div>
    </div>
  )
}

export default StateRanking
