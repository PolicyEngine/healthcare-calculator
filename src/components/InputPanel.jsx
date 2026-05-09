import { useState } from 'react'
import { createInitialInputs } from '../dataLookup'

function InfoTooltip({ text }) {
  return (
    <span className="info-tooltip-wrapper">
      <span className="info-tooltip-icon">i</span>
      <span className="info-tooltip-text">{text}</span>
    </span>
  )
}

const formatWithCommas = (value) => {
  const number = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value
  if (Number.isNaN(number)) return '0'
  return number.toLocaleString('en-US')
}

const createAdult = (index) => ({
  age: index === 0 ? 40 : 38,
  has_esi: false,
  is_pregnant: false,
  immigration_status: 'Citizen',
})

const createChild = (age = 8) => ({
  age,
  immigration_status: 'Citizen',
})

function ToggleField({ label, value, onChange, disabled = false }) {
  return (
    <div className="toggle-field">
      <span>{label}</span>
      <div className="toggle-pill-group" role="group" aria-label={label}>
        <button
          type="button"
          className={`toggle-pill ${!value ? 'active' : ''}`}
          onClick={() => onChange(false)}
          disabled={disabled}
        >
          No
        </button>
        <button
          type="button"
          className={`toggle-pill ${value ? 'active' : ''}`}
          onClick={() => onChange(true)}
          disabled={disabled}
        >
          Yes
        </button>
      </div>
    </div>
  )
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
  const [formData, setFormData] = useState(() => createInitialInputs())
  const [incomeDisplay, setIncomeDisplay] = useState(() => formatWithCommas(createInitialInputs().tax_unit_magi))

  const updateFormData = (updater) => {
    setFormData((current) => {
      const nextValue = typeof updater === 'function' ? updater(current) : updater
      return nextValue
    })
    onInputChange?.()
  }

  const setAdultCount = (count) => {
    updateFormData((current) => {
      const adults = Array.from({ length: count }, (_, index) => current.adults[index] || createAdult(index))
      return { ...current, adults }
    })
  }

  const setChildCount = (count) => {
    updateFormData((current) => {
      const fallbackAge = current.children[current.children.length - 1]?.age || 8
      const children = Array.from(
        { length: count },
        (_, index) => current.children[index] || createChild(fallbackAge),
      )
      return { ...current, children }
    })
  }

  const handleIncomeChange = (event) => {
    const cleaned = event.target.value.replace(/[^0-9]/g, '')
    const numericValue = parseFloat(cleaned) || 0

    setIncomeDisplay(numericValue === 0 ? '' : formatWithCommas(numericValue))
    updateFormData((current) => ({
      ...current,
      tax_unit_magi: numericValue,
    }))
  }

  const handleIncomeBlur = () => {
    setIncomeDisplay(formatWithCommas(formData.tax_unit_magi))
  }

  const handleIncomeFocus = () => {
    setIncomeDisplay(formData.tax_unit_magi === 0 ? '' : formatWithCommas(formData.tax_unit_magi))
  }

  const handleAdultChange = (index, field, value) => {
    updateFormData((current) => ({
      ...current,
      adults: current.adults.map((adult, adultIndex) => (
        adultIndex === index
          ? { ...adult, [field]: value }
          : adult
      )),
    }))
  }

  const handleChildAgeChange = (index, value) => {
    updateFormData((current) => ({
      ...current,
      children: current.children.map((child, childIndex) => (
        childIndex === index
          ? { ...child, age: value }
          : child
      )),
    }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    onCalculate({
      ...formData,
      state: selectedState,
      year: 2026,
    })
  }

  const handleReset = () => {
    const initialFormData = createInitialInputs()
    setFormData(initialFormData)
    setIncomeDisplay(formatWithCommas(initialFormData.tax_unit_magi))
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
              value={formData.adults.length}
              onChange={(event) => setAdultCount(parseFloat(event.target.value) || 1)}
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
              value={formData.children.length}
              onChange={(event) => setChildCount(Math.max(0, Math.min(7, parseFloat(event.target.value) || 0)))}
            />
          </div>

          <div className="form-group">
            <label htmlFor="tax_unit_magi">
              Annual MAGI
              <InfoTooltip text="Modified adjusted gross income for the tax household. This drives ACA premium tax credits and much of Medicaid and CHIP eligibility." />
            </label>
            <input
              type="text"
              inputMode="numeric"
              id="tax_unit_magi"
              name="tax_unit_magi"
              value={incomeDisplay}
              onChange={handleIncomeChange}
              onBlur={handleIncomeBlur}
              onFocus={handleIncomeFocus}
            />
          </div>
        </div>

        <section className="person-section">
          <div className="person-section-header">
            <h3>Adults</h3>
            <p>Age, employer coverage, and pregnancy can change Medicaid and ACA results.</p>
          </div>
          <div className="person-cards">
            {formData.adults.map((adult, index) => (
              <div key={`adult-${index + 1}`} className="person-card">
                <div className="person-card-header">Adult {index + 1}</div>
                <div className="person-card-grid">
                  <div className="form-group">
                    <label htmlFor={`adult-age-${index + 1}`}>Age</label>
                    <input
                      type="number"
                      id={`adult-age-${index + 1}`}
                      min="0"
                      max="120"
                      value={adult.age}
                      onChange={(event) => handleAdultChange(index, 'age', parseFloat(event.target.value) || 0)}
                    />
                  </div>
                  <ToggleField
                    label="Employer plan available"
                    value={adult.has_esi}
                    onChange={(value) => handleAdultChange(index, 'has_esi', value)}
                  />
                  <ToggleField
                    label="Pregnant"
                    value={adult.is_pregnant}
                    onChange={(value) => handleAdultChange(index, 'is_pregnant', value)}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="person-section">
          <div className="person-section-header">
            <h3>Children</h3>
            <p>Set each child&apos;s age for Medicaid and CHIP comparisons.</p>
          </div>
          {formData.children.length > 0 ? (
            <div className="child-age-grid">
              {formData.children.map((child, index) => (
                <div key={`child-${index + 1}`} className="form-group child-age-card">
                  <label htmlFor={`child-age-${index + 1}`}>Child {index + 1} age</label>
                  <input
                    type="number"
                    id={`child-age-${index + 1}`}
                    min="0"
                    max="26"
                    value={child.age}
                    onChange={(event) => handleChildAgeChange(index, parseFloat(event.target.value) || 0)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="section-note">No children in the household.</p>
          )}
        </section>

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
