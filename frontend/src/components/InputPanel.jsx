import { useState } from 'react'

function InfoTooltip({ text }) {
  return (
    <span className="info-tooltip-wrapper">
      <span className="info-tooltip-icon">i</span>
      <span className="info-tooltip-text">{text}</span>
    </span>
  )
}

const INITIAL_FORM_DATA = {
  num_adults: 1,
  num_children: 2,
  earned_income: 0,
  unearned_income: 0,
}

const formatWithCommas = (value) => {
  const number = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value
  if (Number.isNaN(number)) return '0'
  return number.toLocaleString('en-US')
}

function InputPanel({
  selectedState,
  states,
  onCalculate,
  onInputChange,
  onReset,
  onStateSelect,
  loading,
}) {
  const [formData, setFormData] = useState(INITIAL_FORM_DATA)
  const [incomeDisplay, setIncomeDisplay] = useState({
    earned_income: '0',
    unearned_income: '0',
  })

  const handleChange = (event) => {
    const { name, value } = event.target

    setFormData((current) => ({
      ...current,
      [name]: ['num_adults', 'num_children'].includes(name) ? parseFloat(value) || 0 : value,
    }))

    onInputChange?.()
  }

  const handleIncomeChange = (event) => {
    const { name, value } = event.target
    const cleaned = value.replace(/[^0-9]/g, '')
    const numericValue = parseFloat(cleaned) || 0

    setIncomeDisplay((current) => ({
      ...current,
      [name]: numericValue === 0 ? '' : formatWithCommas(numericValue),
    }))
    setFormData((current) => ({
      ...current,
      [name]: numericValue,
    }))

    onInputChange?.()
  }

  const handleIncomeBlur = (event) => {
    const { name } = event.target
    setIncomeDisplay((current) => ({
      ...current,
      [name]: formatWithCommas(formData[name]),
    }))
  }

  const handleIncomeFocus = (event) => {
    const { name } = event.target
    const value = formData[name]
    setIncomeDisplay((current) => ({
      ...current,
      [name]: value === 0 ? '' : formatWithCommas(value),
    }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    onCalculate({
      ...formData,
      state: selectedState,
      year: 2026,
      earned_income: formData.earned_income * 12,
      unearned_income: formData.unearned_income * 12,
    })
  }

  const handleReset = () => {
    setFormData(INITIAL_FORM_DATA)
    setIncomeDisplay({
      earned_income: '0',
      unearned_income: '0',
    })
    onReset?.()
  }

  return (
    <section className="input-panel">
      <h2>Household information</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="state">State</label>
            <select
              id="state"
              name="state"
              value={selectedState}
              onChange={(event) => onStateSelect(event.target.value)}
            >
              {states.map((state) => (
                <option key={state.code} value={state.code}>
                  {state.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="num_adults">Adults</label>
            <select
              id="num_adults"
              name="num_adults"
              value={formData.num_adults}
              onChange={handleChange}
            >
              <option value={1}>1 adult</option>
              <option value={2}>2 adults</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="num_children">Children</label>
            <input
              type="number"
              id="num_children"
              name="num_children"
              min="0"
              max="7"
              value={formData.num_children}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="earned_income">
              Earned income ($/month)
              <InfoTooltip text="Income from wages, salaries, tips, and self-employment." />
            </label>
            <input
              type="text"
              inputMode="numeric"
              id="earned_income"
              name="earned_income"
              value={incomeDisplay.earned_income}
              onChange={handleIncomeChange}
              onBlur={handleIncomeBlur}
              onFocus={handleIncomeFocus}
            />
          </div>

          <div className="form-group">
            <label htmlFor="unearned_income">
              Unearned income ($/month)
              <InfoTooltip text="Income such as unemployment, child support, Social Security, pensions, or rental income." />
            </label>
            <input
              type="text"
              inputMode="numeric"
              id="unearned_income"
              name="unearned_income"
              value={incomeDisplay.unearned_income}
              onChange={handleIncomeChange}
              onBlur={handleIncomeBlur}
              onFocus={handleIncomeFocus}
            />
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="reset-btn" onClick={handleReset}>
            Reset
          </button>
          <button type="submit" className="calculate-btn" disabled={loading}>
            {loading ? 'Calculating...' : 'Calculate support'}
          </button>
        </div>
      </form>
    </section>
  )
}

export default InputPanel
