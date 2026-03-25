function ResultsPanel({
  result,
  comparisonData,
  loading,
  error,
  onRetry,
}) {
  if (error) {
    return (
      <section className="results-panel">
        <div className="error">
          {error}
          {onRetry && (
            <button className="retry-btn" onClick={onRetry}>Try Again</button>
          )}
        </div>
      </section>
    )
  }

  if (loading) {
    return (
      <section className="results-panel">
        <div className="loading">Calculating healthcare support...</div>
      </section>
    )
  }

  if (!result) {
    return (
      <section className="results-panel">
        <div className="placeholder">
          Enter your household information and click Calculate to compare ACA, Medicaid, and CHIP support across states.
        </div>
      </section>
    )
  }

  const formatCurrency = (amount) => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)

  const activePrograms = result.programs.filter((program) => program.amount > 0)
  const stateRank = comparisonData
    ? (() => {
        const eligibleStates = comparisonData.filter(
          (state) => !state.error && state.support_monthly > 0,
        )
        const index = eligibleStates.findIndex((state) => state.state === result.state)
        return index >= 0 ? { rank: index + 1, total: eligibleStates.length } : null
      })()
    : null

  return (
    <section className="results-panel">
      <div className={`result-banner ${!result.eligible ? 'not-eligible' : ''}`}>
        <div className="result-banner-main">
          <h3>Estimated Monthly Healthcare Support</h3>
          <div className="amount">{formatCurrency(result.support_monthly)}</div>
          <div className="amount-annual">{formatCurrency(result.support_annual)}/yr</div>
        </div>
        <div className="result-banner-details">
          <span className={`eligibility-status ${result.eligible ? 'eligible' : 'not-eligible'}`}>
            {result.eligible
              ? `${activePrograms.length} active program${activePrograms.length === 1 ? '' : 's'}`
              : 'No estimated support'}
          </span>
          <div className="result-meta">
            <span>{result.state_name} ({result.state})</span>
            <span>{result.household.num_adults} adult(s), {result.household.num_children} child(ren)</span>
            <span>{formatCurrency(result.household.tax_unit_magi)} MAGI</span>
            <span>{activePrograms.length > 0 ? activePrograms.map((program) => program.short_label).join(' + ') : 'Marketplace only, no modeled assistance'}</span>
          </div>
        </div>
        <div className="result-banner-stats">
          {stateRank && (
            <div className="stat-item">
              <span className="stat-label">State rank</span>
              <span className="stat-value">#{stateRank.rank} of {stateRank.total}</span>
            </div>
          )}
        </div>
        {!result.eligible && (
          <div className="result-banner-ineligible">
            This calculator does not estimate ACA, Medicaid, or CHIP assistance for this household in {result.state_name}.
          </div>
        )}
      </div>

      <details className="benefit-breakdown" open>
        <summary>Program breakdown</summary>
        <div className="breakdown-content">
          {result.breakdown.programs.map((program) => (
            <div key={program.key}>
              <div className="breakdown-row">
                <span className="breakdown-label">{program.label}</span>
                <span className={`breakdown-value ${program.amount > 0 ? 'positive' : ''}`}>
                  {formatCurrency(program.amount)}/mo
                </span>
              </div>
              <div className="breakdown-row sub">
                <span className="breakdown-label">{program.detail}</span>
              </div>
            </div>
          ))}

          <div className="breakdown-divider" />
          <div className="breakdown-row total">
            <span className="breakdown-label">Total estimated support</span>
            <span className="breakdown-value positive">{formatCurrency(result.support_monthly)}/mo</span>
          </div>
          {result.notes.map((note) => (
            <div key={note} className="breakdown-row sub">
              <span className="breakdown-label">{note}</span>
            </div>
          ))}
        </div>
      </details>
    </section>
  )
}

export default ResultsPanel
