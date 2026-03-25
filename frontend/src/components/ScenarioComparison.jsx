import { useEffect, useMemo, useState } from 'react'
import { buildScenarioInputs, calculateStateResult } from '../dataLookup'

function ScenarioComparison({ defaultInputs, baselineResult }) {
  const baseAdultCount = defaultInputs.adults.length
  const baseChildCount = defaultInputs.children.length

  const [scenarioB, setScenarioB] = useState({
    num_adults: baseAdultCount,
    num_children: baseChildCount,
    tax_unit_magi: defaultInputs.tax_unit_magi,
  })
  const [supportB, setSupportB] = useState(baselineResult)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setScenarioB({
      num_adults: defaultInputs.adults.length,
      num_children: defaultInputs.children.length,
      tax_unit_magi: defaultInputs.tax_unit_magi,
    })
    setSupportB(baselineResult)
    setError(null)
    setLoading(false)
  }, [baselineResult, defaultInputs])

  const formatCurrency = (amount) => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)

  const programSummary = (support) => (
    support?.programs?.filter((program) => program.amount > 0).map((program) => program.short_label).join(' + ')
    || 'No estimated support'
  )

  const hasChanges = scenarioB.num_adults !== baseAdultCount
    || scenarioB.num_children !== baseChildCount
    || scenarioB.tax_unit_magi !== defaultInputs.tax_unit_magi

  const nextScenarioInputs = useMemo(
    () => buildScenarioInputs(defaultInputs, scenarioB),
    [defaultInputs, scenarioB],
  )

  useEffect(() => {
    if (!hasChanges) {
      setSupportB(baselineResult)
      setLoading(false)
      setError(null)
      return undefined
    }

    let cancelled = false
    const timeoutId = window.setTimeout(async () => {
      setLoading(true)
      setError(null)

      try {
        const nextResult = await calculateStateResult(nextScenarioInputs)

        if (!cancelled) {
          setSupportB(nextResult.result)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to compare scenarios.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [baselineResult, hasChanges, nextScenarioInputs])

  const handleSlider = (name, value) => {
    setScenarioB((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const diff = baselineResult && supportB ? supportB.support_monthly - baselineResult.support_monthly : 0

  const sliders = [
    {
      name: 'num_children',
      label: 'Children',
      min: 0,
      max: 7,
      step: 1,
      value: scenarioB.num_children,
      originalValue: baseChildCount,
      format: (value) => String(value),
    },
    {
      name: 'tax_unit_magi',
      label: 'Annual MAGI',
      min: 0,
      max: 120000,
      step: 2000,
      value: scenarioB.tax_unit_magi,
      originalValue: defaultInputs.tax_unit_magi,
      format: (value) => `${formatCurrency(value)}/yr`,
    },
  ]

  return (
    <section className="scenario-comparison-v2">
      <div className="scenario-current">
        <span className="scenario-current-label">Current</span>
        <div className="scenario-current-chips">
          <span className="scenario-chip">{baseAdultCount} Adult{baseAdultCount > 1 ? 's' : ''}</span>
          <span className="scenario-chip">{baseChildCount} Child{baseChildCount !== 1 ? 'ren' : ''}</span>
          <span className="scenario-chip">{formatCurrency(defaultInputs.tax_unit_magi)}/yr MAGI</span>
          <span className="scenario-chip">{programSummary(baselineResult)}</span>
        </div>
        {baselineResult && (
          <div className="scenario-current-benefit">
            {formatCurrency(baselineResult.support_monthly)}/mo
          </div>
        )}
      </div>

      <p className="scenario-hint">Adjust the sliders below to compare a nearby healthcare scenario in the same state.</p>
      <div className={`scenario-toggle-row ${scenarioB.num_adults !== baseAdultCount ? 'changed' : ''}`}>
        <span className="scenario-slider-label">Adults</span>
        <div className="scenario-toggle">
          <button
            type="button"
            className={`toggle-btn ${scenarioB.num_adults === 1 ? 'active' : ''}`}
            onClick={() => handleSlider('num_adults', 1)}
          >
            1 adult
          </button>
          <button
            type="button"
            className={`toggle-btn ${scenarioB.num_adults === 2 ? 'active' : ''}`}
            onClick={() => handleSlider('num_adults', 2)}
          >
            2 adults
          </button>
        </div>
      </div>

      <div className="scenario-sliders">
        {sliders.map((slider) => {
          const changed = slider.value !== slider.originalValue
          return (
            <div key={slider.name} className={`scenario-slider-row ${changed ? 'changed' : ''}`}>
              <div className="scenario-slider-header">
                <span className="scenario-slider-label">{slider.label}</span>
                <span className={`scenario-slider-value ${changed ? 'changed' : ''}`}>
                  {slider.format(slider.value)}
                </span>
              </div>
              <input
                type="range"
                min={slider.min}
                max={slider.max}
                step={slider.step}
                value={slider.value}
                onChange={(event) => handleSlider(slider.name, parseFloat(event.target.value))}
                className="scenario-range"
              />
              <div className="scenario-slider-bounds">
                <span>{slider.format(slider.min)}</span>
                <span>{slider.format(slider.max)}</span>
              </div>
            </div>
          )
        })}
      </div>

      {baselineResult && supportB && (
        <div className={`scenario-live-result ${!hasChanges ? 'no-change' : ''}`}>
          <div className="scenario-result-bar">
            <div className="scenario-result-side">
              <span className="scenario-result-tag">Current</span>
              <span className={`scenario-result-val ${baselineResult.eligible ? '' : 'not-eligible'}`}>
                {formatCurrency(baselineResult.support_monthly)}/mo
              </span>
            </div>

            <div className={`scenario-result-diff ${diff > 0 ? 'positive' : diff < 0 ? 'negative' : 'neutral'}`}>
              <span className="diff-icon">{loading ? '...' : diff > 0 ? '\u2191' : diff < 0 ? '\u2193' : '='}</span>
              <span className="diff-amount">
                {loading ? 'Updating' : `${diff > 0 ? '+' : ''}${formatCurrency(diff)}/mo`}
              </span>
            </div>

            <div className="scenario-result-side">
              <span className="scenario-result-tag">What if</span>
              <span className={`scenario-result-val ${supportB.eligible ? '' : 'not-eligible'}`}>
                {loading ? '...' : `${formatCurrency(supportB.support_monthly)}/mo`}
              </span>
            </div>
          </div>

          {programSummary(baselineResult) !== programSummary(supportB) && !loading && (
            <div className="scenario-eligibility-change">
              Programs change: {programSummary(baselineResult)} {'->'} {programSummary(supportB)}
            </div>
          )}
          {error && (
            <div className="scenario-error">
              {error}
            </div>
          )}
        </div>
      )}

      {hasChanges && (
        <button
          type="button"
          className="scenario-reset-btn"
          onClick={() => setScenarioB({
            num_adults: baseAdultCount,
            num_children: baseChildCount,
            tax_unit_magi: defaultInputs.tax_unit_magi,
          })}
        >
          Reset to current
        </button>
      )}
    </section>
  )
}

export default ScenarioComparison
