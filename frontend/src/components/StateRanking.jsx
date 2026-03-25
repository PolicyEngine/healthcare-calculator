import { useMemo, useState } from 'react'

const DEFAULT_TIER_COUNT = 5

function StateRanking({ data, selectedState, onStateSelect }) {
  const [expanded, setExpanded] = useState(false)

  const tierGroups = useMemo(() => {
    if (!data) return []

    const groups = []
    for (const item of data) {
      const existing = groups[groups.length - 1]
      if (existing && existing.accessTier === item.access_tier) {
        existing.states.push(item)
      } else {
        groups.push({
          accessTier: item.access_tier,
          accessSummary: item.access_summary,
          states: [item],
        })
      }
    }
    return groups
  }, [data])

  const visibleGroups = expanded ? tierGroups : tierGroups.slice(0, DEFAULT_TIER_COUNT)

  const selectedStateData = useMemo(
    () => data?.find((item) => item.state === selectedState) || null,
    [data, selectedState],
  )

  if (!data || tierGroups.length === 0) {
    return <p className="ranking-empty">No states show modeled assistance for this household.</p>
  }

  return (
    <div className="state-ranking">
      {selectedStateData && (
        <div className="selected-state-rank">
          <span className="rank-badge">T{selectedStateData.access_tier}</span>
          <span className="rank-text">
            <strong>{selectedStateData.state_name}</strong> is in tier {selectedStateData.access_tier} of {tierGroups.length}
            {' '}
            for modeled healthcare access.
            {' '}
            <strong>{selectedStateData.access_summary}</strong>
          </span>
        </div>
      )}

      <div className="ranking-tier-list">
        {visibleGroups.map((group) => (
          <section key={group.accessTier} className="ranking-tier-card">
            <div className="ranking-tier-header">
              <div>
                <div className="ranking-tier-badge">Tier {group.accessTier}</div>
                <h3>{group.accessSummary}</h3>
                <p>{group.states.length} state{group.states.length === 1 ? '' : 's'} share this access pattern</p>
              </div>
            </div>

            <div className="ranking-state-chips">
              {group.states.map((state) => (
                <button
                  key={state.state}
                  type="button"
                  className={`ranking-state-chip ${state.state === selectedState ? 'active' : ''}`}
                  onClick={() => onStateSelect(state.state)}
                >
                  <span className="ranking-state-name">{state.state_name}</span>
                  <span className="ranking-state-code">{state.state}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="ranking-footer">
        {tierGroups.length > DEFAULT_TIER_COUNT && (
          <button className="expand-btn" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Show fewer tiers' : `Show all ${tierGroups.length} tiers`}
          </button>
        )}
        <p>Click a state to switch the selected result</p>
      </div>
    </div>
  )
}

export default StateRanking
