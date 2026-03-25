import { useCallback, useEffect, useState } from 'react'
import { loadStateData, lookupSupport } from '../dataLookup'

function ScenarioComparison({ defaultInputs }) {
  const earnedA = Math.round(defaultInputs.earned_income / 12)
  const unearnedA = Math.round(defaultInputs.unearned_income / 12)

  const [scenarioB, setScenarioB] = useState({
    num_adults: defaultInputs.num_adults,
    num_children: defaultInputs.num_children,
    earned_income: earnedA,
    unearned_income: unearnedA,
  })
  const [supportA, setSupportA] = useState(null)
  const [supportB, setSupportB] = useState(null)
  const [stateData, setStateData] = useState(null)

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

  useEffect(() => {
    loadStateData(defaultInputs.state).then((data) => {
      setStateData(data)
    })
  }, [defaultInputs.state])

  const computeSupport = useCallback(() => {
    if (!stateData) return

    setSupportA(
      lookupSupport(
        stateData,
        defaultInputs.num_adults,
        defaultInputs.num_children,
        earnedA,
        unearnedA,
      ),
    )
    setSupportB(
      lookupSupport(
        stateData,
        scenarioB.num_adults,
        scenarioB.num_children,
        scenarioB.earned_income,
        scenarioB.unearned_income,
      ),
    )
  }, [defaultInputs.num_adults, defaultInputs.num_children, earnedA, scenarioB, stateData, unearnedA])

  useEffect(() => {
    computeSupport()
  }, [computeSupport])

  const handleSlider = (name, value) => {
    setScenarioB((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const diff = supportA && supportB ? supportB.support_monthly - supportA.support_monthly : 0
  const hasChanges = scenarioB.num_adults !== defaultInputs.num_adults
    || scenarioB.num_children !== defaultInputs.num_children
    || scenarioB.earned_income !== earnedA
    || scenarioB.unearned_income !== unearnedA

  const sliders = [
    {
      name: 'num_children',
      label: 'Children',
      min: 0,
      max: 7,
      step: 1,
      value: scenarioB.num_children,
      originalValue: defaultInputs.num_children,
      format: (value) => String(value),
    },
    {
      name: 'earned_income',
      label: 'Earned income',
      min: 0,
      max: 7000,
      step: 100,
      value: scenarioB.earned_income,
      originalValue: earnedA,
      format: (value) => `${formatCurrency(value)}/mo`,
    },
    {
      name: 'unearned_income',
      label: 'Unearned income',
      min: 0,
      max: 5000,
      step: 100,
      value: scenarioB.unearned_income,
      originalValue: unearnedA,
      format: (value) => `${formatCurrency(value)}/mo`,
    },
  ]

  return (
    <section className="scenario-comparison-v2">
      <div className="scenario-current">
        <span className="scenario-current-label">Current</span>
        <div className="scenario-current-chips">
          <span className="scenario-chip">{defaultInputs.num_adults} Adult{defaultInputs.num_adults > 1 ? 's' : ''}</span>
          <span className="scenario-chip">{defaultInputs.num_children} Child{defaultInputs.num_children !== 1 ? 'ren' : ''}</span>
          <span className="scenario-chip">{formatCurrency(earnedA)}/mo earned</span>
          <span className="scenario-chip">{formatCurrency(unearnedA)}/mo unearned</span>
          <span className="scenario-chip">{programSummary(supportA)}</span>
        </div>
        {supportA && (
          <div className="scenario-current-benefit">
            {formatCurrency(supportA.support_monthly)}/mo
          </div>
        )}
      </div>

      <p className="scenario-hint">Adjust the values below to explore different healthcare support scenarios</p>
      <div className={`scenario-toggle-row ${scenarioB.num_adults !== defaultInputs.num_adults ? 'changed' : ''}`}>
        <span className="scenario-slider-label">Adults</span>
        <div className="scenario-toggle">
          <button
            className={`toggle-btn ${scenarioB.num_adults === 1 ? 'active' : ''}`}
            onClick={() => handleSlider('num_adults', 1)}
          >
            1 adult
          </button>
          <button
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

      {supportA && supportB && (
        <div className={`scenario-live-result ${!hasChanges ? 'no-change' : ''}`}>
          <div className="scenario-result-bar">
            <div className="scenario-result-side">
              <span className="scenario-result-tag">Current</span>
              <span className={`scenario-result-val ${supportA.eligible ? '' : 'not-eligible'}`}>
                {formatCurrency(supportA.support_monthly)}/mo
              </span>
            </div>

            <div className={`scenario-result-diff ${diff > 0 ? 'positive' : diff < 0 ? 'negative' : 'neutral'}`}>
              <span className="diff-icon">{diff > 0 ? '\u2191' : diff < 0 ? '\u2193' : '='}</span>
              <span className="diff-amount">
                {diff > 0 ? '+' : ''}{formatCurrency(diff)}/mo
              </span>
            </div>

            <div className="scenario-result-side">
              <span className="scenario-result-tag">What if</span>
              <span className={`scenario-result-val ${supportB.eligible ? '' : 'not-eligible'}`}>
                {formatCurrency(supportB.support_monthly)}/mo
              </span>
            </div>
          </div>

          {programSummary(supportA) !== programSummary(supportB) && (
            <div className="scenario-eligibility-change">
              Programs change: {programSummary(supportA)} {'->'} {programSummary(supportB)}
            </div>
          )}
        </div>
      )}

      {hasChanges && (
        <button
          className="scenario-reset-btn"
          onClick={() => setScenarioB({
            num_adults: defaultInputs.num_adults,
            num_children: defaultInputs.num_children,
            earned_income: earnedA,
            unearned_income: unearnedA,
          })}
        >
          Reset to current
        </button>
      )}
    </section>
  )
}

export default ScenarioComparison
