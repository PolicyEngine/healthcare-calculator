import { useEffect, useRef, useState } from 'react'
import StateMap from './components/StateMap'
import InputPanel from './components/InputPanel'
import ResultsPanel from './components/ResultsPanel'
import StateRanking from './components/StateRanking'
import ScenarioComparison from './components/ScenarioComparison'
import {
  loadMetadata,
  loadStateData,
  buildResult,
  generateChartData,
  generateHouseholdSizeData,
  calculateAllStates,
} from './dataLookup'

function App() {
  const [states, setStates] = useState([])
  const [selectedState, setSelectedState] = useState('CA')
  const [loading, setLoading] = useState(false)
  const [comparisonLoading, setComparisonLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [chartData, setChartData] = useState(null)
  const [householdSizeData, setHouseholdSizeData] = useState(null)
  const [comparisonData, setComparisonData] = useState(null)
  const [maxSupport, setMaxSupport] = useState(0)
  const [lastInputs, setLastInputs] = useState(null)
  const [activeTab, setActiveTab] = useState('State comparison')
  const resultsRef = useRef(null)

  useEffect(() => {
    loadMetadata()
      .then((meta) => setStates(meta.states))
      .catch(() => setError('Failed to load the healthcare calculator prototype.'))
  }, [])

  const clearResults = () => {
    setResult(null)
    setChartData(null)
    setHouseholdSizeData(null)
    setComparisonData(null)
    setMaxSupport(0)
    setError(null)
    setActiveTab('State comparison')
  }

  const calculateForState = async (inputs, stateCode = inputs.state) => {
    const earnedMonthly = inputs.earned_income / 12
    const unearnedMonthly = inputs.unearned_income / 12
    const stateData = await loadStateData(stateCode)
    const stateName = states.find((state) => state.code === stateCode)?.name || stateCode

    return {
      calcResult: buildResult(
        stateData,
        stateCode,
        stateName,
        inputs.num_adults,
        inputs.num_children,
        earnedMonthly,
        unearnedMonthly,
      ),
      chart: generateChartData(
        stateData,
        inputs.num_adults,
        inputs.num_children,
        earnedMonthly,
        unearnedMonthly,
      ),
      householdSize: generateHouseholdSizeData(
        stateData,
        inputs.num_adults,
        earnedMonthly,
        unearnedMonthly,
      ),
    }
  }

  const handleStateSelect = async (stateCode) => {
    setSelectedState(stateCode)

    if (!lastInputs || !result) {
      return
    }

    try {
      const updatedInputs = { ...lastInputs, state: stateCode }
      const nextResult = await calculateForState(updatedInputs, stateCode)

      setResult(nextResult.calcResult)
      setChartData({ data: nextResult.chart })
      setHouseholdSizeData(nextResult.householdSize)
      setLastInputs(updatedInputs)
      setError(null)
    } catch {
      setError('Failed to refresh the selected state.')
    }
  }

  const handleInputChange = () => {
    clearResults()
  }

  const handleReset = () => {
    clearResults()
    setLastInputs(null)
  }

  const handleCalculate = async (inputs) => {
    setLoading(true)
    setError(null)
    setLastInputs(inputs)
    setActiveTab('State comparison')

    try {
      const nextResult = await calculateForState(inputs)

      setResult(nextResult.calcResult)
      setChartData({ data: nextResult.chart })
      setHouseholdSizeData(nextResult.householdSize)
      setLoading(false)

      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)

      setComparisonLoading(true)
      try {
        const earnedMonthly = inputs.earned_income / 12
        const unearnedMonthly = inputs.unearned_income / 12
        const allStatesResult = await calculateAllStates(
          inputs.num_adults,
          inputs.num_children,
          earnedMonthly,
          unearnedMonthly,
        )

        setComparisonData(allStatesResult.states)
        setMaxSupport(allStatesResult.max_support)
      } finally {
        setComparisonLoading(false)
      }
    } catch (err) {
      setError(err.message || 'Calculation failed. Please try again.')
      setLoading(false)
    }
  }

  const handleRetry = () => {
    if (lastInputs) {
      handleCalculate(lastInputs)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Healthcare Calculator</h1>
        <p>Estimate ACA, Medicaid, and CHIP support across states</p>
      </header>

      <div className="top-layout">
        <InputPanel
          selectedState={selectedState}
          states={states}
          onCalculate={handleCalculate}
          onInputChange={handleInputChange}
          onReset={handleReset}
          onStateSelect={handleStateSelect}
          loading={loading}
        />

        <section className="map-section">
          <h2>{comparisonData ? 'Healthcare support by state' : 'Select your state'}</h2>
          {comparisonLoading && (
            <div className="loading">Loading state comparison...</div>
          )}
          <StateMap
            selectedState={selectedState}
            availableStates={states}
            onStateSelect={handleStateSelect}
            comparisonData={comparisonData}
            maxSupport={maxSupport}
          />
        </section>
      </div>

      <div ref={resultsRef} />
      {(result || loading || error) && (
        <ResultsPanel
          result={result}
          chartData={chartData}
          householdSizeData={householdSizeData}
          comparisonData={comparisonData}
          loading={loading}
          error={error}
          onRetry={lastInputs ? handleRetry : null}
        />
      )}

      {result && (
        <section className="tabbed-section">
          <div className="tab-bar">
            {['State comparison', 'Scenario comparison'].map((tab) => (
              <button
                key={tab}
                className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="tab-content">
            {activeTab === 'State comparison' && comparisonData && (
              <StateRanking
                data={comparisonData}
                selectedState={selectedState}
                onStateSelect={handleStateSelect}
              />
            )}
            {activeTab === 'State comparison' && !comparisonData && comparisonLoading && (
              <div className="loading">Loading state comparison...</div>
            )}
            {activeTab === 'Scenario comparison' && lastInputs && (
              <ScenarioComparison defaultInputs={lastInputs} />
            )}
          </div>
        </section>
      )}

      <footer className="app-footer">
        <p>
          This first pass is a UI prototype that mirrors the TANF calculator interaction pattern with illustrative placeholder healthcare rules.
          Age, immigration status, pregnancy, disability, employer offers, and detailed state waiver logic are not modeled yet.
        </p>
      </footer>
    </div>
  )
}

export default App
