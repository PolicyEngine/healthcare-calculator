import { useEffect, useRef, useState } from 'react'
import StateMap from './components/StateMap'
import InputPanel from './components/InputPanel'
import ResultsPanel from './components/ResultsPanel'
import StateRanking from './components/StateRanking'
import ScenarioComparison from './components/ScenarioComparison'
import {
  loadMetadata,
  calculateAllStates,
  calculateStateResult,
} from './dataLookup'

function App() {
  const [states, setStates] = useState([])
  const [selectedState, setSelectedState] = useState('CA')
  const [loading, setLoading] = useState(false)
  const [comparisonLoading, setComparisonLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [comparisonData, setComparisonData] = useState(null)
  const [maxSupport, setMaxSupport] = useState(0)
  const [lastInputs, setLastInputs] = useState(null)
  const [activeTab, setActiveTab] = useState('State comparison')
  const requestIdRef = useRef(0)
  const resultsRef = useRef(null)

  useEffect(() => {
    loadMetadata()
      .then((meta) => setStates(meta.states))
      .catch(() => setError('Failed to load the healthcare calculator.'))
  }, [])

  const clearResults = () => {
    setResult(null)
    setComparisonData(null)
    setMaxSupport(0)
    setError(null)
    setComparisonLoading(false)
    setActiveTab('State comparison')
  }

  const loadStateComparison = async (inputs, requestId) => {
    setComparisonLoading(true)

    try {
      const allStatesResult = await calculateAllStates(inputs)

      if (requestId !== requestIdRef.current) {
        return
      }

      setComparisonData(allStatesResult.states)
      setMaxSupport(allStatesResult.max_support)
    } catch {
      if (requestId !== requestIdRef.current) {
        return
      }

      setComparisonData(null)
      setMaxSupport(0)
    } finally {
      if (requestId === requestIdRef.current) {
        setComparisonLoading(false)
      }
    }
  }

  const handleStateSelect = async (stateCode) => {
    setSelectedState(stateCode)

    if (!lastInputs || !result) {
      return
    }

    const requestId = ++requestIdRef.current
    const updatedInputs = { ...lastInputs, state: stateCode }

    setLoading(true)
    setError(null)
    setLastInputs(updatedInputs)

    try {
      const nextResult = await calculateStateResult(updatedInputs)

      if (requestId !== requestIdRef.current) {
        return
      }

      setResult(nextResult.result)
      setLoading(false)
    } catch (err) {
      if (requestId !== requestIdRef.current) {
        return
      }

      setError(err.message || 'Failed to refresh the selected state.')
      setLoading(false)
    }
  }

  const handleInputChange = () => {
    clearResults()
    setLastInputs(null)
  }

  const handleReset = () => {
    clearResults()
    setLastInputs(null)
  }

  const handleCalculate = async (inputs) => {
    const requestId = ++requestIdRef.current

    setLoading(true)
    setComparisonLoading(false)
    setError(null)
    setResult(null)
    setComparisonData(null)
    setMaxSupport(0)
    setLastInputs(inputs)
    setActiveTab('State comparison')

    try {
      const nextResult = await calculateStateResult(inputs)

      if (requestId !== requestIdRef.current) {
        return
      }

      setResult(nextResult.result)
      setLoading(false)

      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)

      void loadStateComparison(inputs, requestId)
    } catch (err) {
      if (requestId !== requestIdRef.current) {
        return
      }

      setError(err.message || 'Calculation failed. Please try again.')
      setLoading(false)
      setComparisonLoading(false)
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

      <main>
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
            <div className="loading loading-inline">Loading state comparison...</div>
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
            {activeTab === 'Scenario comparison' && lastInputs && result && (
              <ScenarioComparison defaultInputs={lastInputs} baselineResult={result} />
            )}
          </div>
        </section>
      )}
      </main>

      <footer className="app-footer">
        Built by <a href="https://policyengine.org">PolicyEngine</a>. Estimates are based on current ACA, Medicaid, and CHIP rules and may not reflect final eligibility.
      </footer>
    </div>
  )
}

export default App
