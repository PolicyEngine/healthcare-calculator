import BenefitChart from './BenefitChart'
import HouseholdSizeChart from './HouseholdSizeChart'

function ResultsPanel({
  result,
  chartData,
  householdSizeData,
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
          Enter your household information and click Calculate to compare illustrative ACA, Medicaid, and CHIP support across states.
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

  const cutoffIncome = chartData?.data
    ? (() => {
        for (let index = 0; index < chartData.data.length; index += 1) {
          const item = chartData.data[index]
          const previous = chartData.data[index - 1]
          if (item.support_monthly === 0 && previous?.support_monthly > 0) {
            return item.total_income_monthly
          }
        }
        return null
      })()
    : null

  const maxSupport = result.breakdown?.max_support_monthly ?? result.support_monthly
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
            <span>{activePrograms.length > 0 ? activePrograms.map((program) => program.short_label).join(' + ') : 'Marketplace only, no modeled assistance'}</span>
          </div>
        </div>
        <div className="result-banner-stats">
          <div className="stat-item">
            <span className="stat-label">Max support</span>
            <span className="stat-value">{formatCurrency(maxSupport)}/mo</span>
          </div>
          {cutoffIncome && (
            <div className="stat-item">
              <span className="stat-label">Support fades out</span>
              <span className="stat-value">{formatCurrency(cutoffIncome)}/mo</span>
            </div>
          )}
          {stateRank && (
            <div className="stat-item">
              <span className="stat-label">State rank</span>
              <span className="stat-value">#{stateRank.rank} of {stateRank.total}</span>
            </div>
          )}
        </div>
        {!result.eligible && (
          <div className="result-banner-ineligible">
            This prototype does not estimate ACA, Medicaid, or CHIP assistance for this household in {result.state_name}.
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

      {chartData && householdSizeData && (
        <div className="charts-grid">
          <div className="chart-container">
            <h3>Support by income</h3>
            <BenefitChart data={chartData.data} />
          </div>
          <div className="chart-container">
            <h3>Support by number of children</h3>
            <HouseholdSizeChart
              data={householdSizeData}
              currentChildren={result.household.num_children}
            />
          </div>
        </div>
      )}
    </section>
  )
}

export default ResultsPanel
