const YEAR = 2026

export const STATE_INFO = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
]

export const STATE_NAME_BY_CODE = Object.fromEntries(
  STATE_INFO.map((state) => [state.code, state.name]),
)

const metadata = {
  year: YEAR,
  notes: [
    'Illustrative placeholder rules that mimic state variation while the production healthcare policy engine is being wired in.',
  ],
  states: STATE_INFO,
  county_data: {},
}

const stateDataCache = {}

const hashCode = (stateCode, salt = 0) => {
  let hash = 97 + salt
  for (const character of stateCode) {
    hash = (hash * 33 + character.charCodeAt(0)) % 1000003
  }
  return hash
}

const bucket = (stateCode, salt, count) => hashCode(stateCode, salt) % count

const round = (value) => Math.round(value)

function buildStateProfile(stateCode) {
  const adultCoverageBand = bucket(stateCode, 1, 5)
  const childCoverageBand = bucket(stateCode, 2, 5)
  const chipBand = bucket(stateCode, 3, 5)
  const acaBand = bucket(stateCode, 4, 6)
  const benchmarkBand = bucket(stateCode, 5, 7)

  return {
    state: stateCode,
    adult_threshold_pct: 55 + adultCoverageBand * 22,
    child_threshold_pct: 155 + childCoverageBand * 18,
    chip_upper_pct: 210 + childCoverageBand * 12 + chipBand * 18,
    aca_upper_pct: 425 + acaBand * 20,
    medicaid_adult_value: 420 + adultCoverageBand * 35,
    medicaid_child_value: 300 + childCoverageBand * 26,
    chip_child_value: 220 + chipBand * 24,
    aca_benchmark_adult: 360 + benchmarkBand * 28,
  }
}

function calculateReferenceIncome(numAdults, numChildren, stateCode) {
  const householdSize = Math.max(1, numAdults + numChildren)
  const schedule = stateCode === 'AK'
    ? { base: 19600, perAdditional: 6920 }
    : stateCode === 'HI'
      ? { base: 18030, perAdditional: 6350 }
      : { base: 15650, perAdditional: 5500 }

  const annual = schedule.base + Math.max(0, householdSize - 1) * schedule.perAdditional

  return {
    annual,
    monthly: annual / 12,
  }
}

function expectedContributionRate(incomePctReference) {
  if (incomePctReference <= 150) return 0
  if (incomePctReference <= 200) return 0.02
  if (incomePctReference <= 250) return 0.04
  if (incomePctReference <= 300) return 0.06
  if (incomePctReference <= 400) return 0.08
  return 0.095
}

export async function loadMetadata() {
  return metadata
}

export async function loadStateData(stateCode) {
  if (!stateDataCache[stateCode]) {
    stateDataCache[stateCode] = buildStateProfile(stateCode)
  }
  return stateDataCache[stateCode]
}

export function getCountyGroup() {
  return null
}

export function lookupSupport(stateData, numAdults, numChildren, earnedMonthly, unearnedMonthly) {
  const totalIncomeMonthly = earnedMonthly + unearnedMonthly
  const totalIncomeAnnual = totalIncomeMonthly * 12
  const referenceIncome = calculateReferenceIncome(numAdults, numChildren, stateData.state)
  const incomePctReference = referenceIncome.annual > 0
    ? (totalIncomeAnnual / referenceIncome.annual) * 100
    : 0

  const adultsOnMedicaid = incomePctReference <= stateData.adult_threshold_pct ? numAdults : 0
  const childrenOnMedicaid = incomePctReference <= stateData.child_threshold_pct ? numChildren : 0
  const childrenOnChip = childrenOnMedicaid < numChildren && incomePctReference <= stateData.chip_upper_pct
    ? numChildren - childrenOnMedicaid
    : 0
  const adultsOnMarketplace = Math.max(0, numAdults - adultsOnMedicaid)

  let acaMonthly = 0
  if (
    adultsOnMarketplace > 0
    && incomePctReference >= 100
    && incomePctReference <= stateData.aca_upper_pct
  ) {
    const benchmarkPremium = adultsOnMarketplace * stateData.aca_benchmark_adult
    const expectedContribution = (totalIncomeAnnual * expectedContributionRate(incomePctReference)) / 12
    acaMonthly = Math.max(0, round(benchmarkPremium - expectedContribution))
  }

  const medicaidMonthly = round(
    adultsOnMedicaid * stateData.medicaid_adult_value
    + childrenOnMedicaid * stateData.medicaid_child_value,
  )
  const chipMonthly = round(childrenOnChip * stateData.chip_child_value)
  const supportMonthly = acaMonthly + medicaidMonthly + chipMonthly
  const eligible = supportMonthly > 0
  const coverageGap = adultsOnMarketplace > 0 && acaMonthly === 0 && incomePctReference < 100

  const programs = [
    {
      key: 'medicaid',
      label: 'Medicaid',
      short_label: 'Medicaid',
      amount: medicaidMonthly,
      detail: medicaidMonthly > 0
        ? `${adultsOnMedicaid} adult(s), ${childrenOnMedicaid} child(ren)`
        : 'No modeled Medicaid support at this income.',
    },
    {
      key: 'chip',
      label: 'CHIP',
      short_label: 'CHIP',
      amount: chipMonthly,
      detail: chipMonthly > 0
        ? `${childrenOnChip} child(ren) in CHIP`
        : 'No modeled CHIP support at this income.',
    },
    {
      key: 'aca',
      label: 'ACA premium tax credits',
      short_label: 'ACA',
      amount: acaMonthly,
      detail: acaMonthly > 0
        ? `${adultsOnMarketplace} adult(s) in marketplace coverage`
        : 'No modeled ACA subsidy at this income.',
    },
  ]

  const notes = []
  if (coverageGap) {
    notes.push('Adults in this prototype household fall below the marketplace subsidy range without enough modeled public coverage.')
  }
  if (!eligible) {
    notes.push('No assistance is estimated in this prototype scenario; unsubsidized marketplace coverage may still be available.')
  }

  return {
    eligible,
    support_monthly: supportMonthly,
    support_annual: supportMonthly * 12,
    aca_monthly: acaMonthly,
    medicaid_monthly: medicaidMonthly,
    chip_monthly: chipMonthly,
    programs,
    notes,
    adults_on_medicaid: adultsOnMedicaid,
    children_on_medicaid: childrenOnMedicaid,
    children_on_chip: childrenOnChip,
    adults_on_marketplace: adultsOnMarketplace,
    total_income_monthly: totalIncomeMonthly,
    total_income_annual: totalIncomeAnnual,
    income_pct_reference: round(incomePctReference * 10) / 10,
    reference_income_annual: referenceIncome.annual,
    reference_income_monthly: referenceIncome.monthly,
  }
}

function getMaxSupport(stateData, numAdults, numChildren) {
  return lookupSupport(stateData, numAdults, numChildren, 0, 0).support_monthly
}

export function generateChartData(
  stateData,
  numAdults,
  numChildren,
  earnedMonthly,
  unearnedMonthly,
  maxIncome = 12000,
  step = 200,
) {
  const totalIncome = earnedMonthly + unearnedMonthly
  const earnedRatio = totalIncome > 0 ? earnedMonthly / totalIncome : 1

  const data = []
  let lastNonZeroIndex = 0

  for (let income = 0; income <= maxIncome; income += step) {
    const earned = income * earnedRatio
    const unearned = income * (1 - earnedRatio)
    const support = lookupSupport(stateData, numAdults, numChildren, earned, unearned)
    data.push({
      total_income_monthly: income,
      support_monthly: support.support_monthly,
      eligible: support.eligible,
    })

    if (support.support_monthly > 0) {
      lastNonZeroIndex = data.length - 1
    }
  }

  const trimIndex = Math.min(lastNonZeroIndex + 5, data.length - 1)
  return data.slice(0, trimIndex + 1)
}

export async function calculateAllStates(numAdults, numChildren, earnedMonthly, unearnedMonthly) {
  const results = await Promise.all(
    STATE_INFO.map(async (state) => {
      const stateData = await loadStateData(state.code)
      const support = lookupSupport(
        stateData,
        numAdults,
        numChildren,
        earnedMonthly,
        unearnedMonthly,
      )

      return {
        state: state.code,
        state_name: state.name,
        support_monthly: support.support_monthly,
        support_annual: support.support_annual,
        eligible: support.eligible,
      }
    }),
  )

  results.sort((left, right) => right.support_monthly - left.support_monthly)

  return {
    states: results,
    max_support: results[0]?.support_monthly || 0,
  }
}

export function buildResult(
  stateData,
  stateCode,
  stateName,
  numAdults,
  numChildren,
  earnedMonthly,
  unearnedMonthly,
) {
  const support = lookupSupport(
    stateData,
    numAdults,
    numChildren,
    earnedMonthly,
    unearnedMonthly,
  )
  const maxSupport = getMaxSupport(stateData, numAdults, numChildren)

  return {
    ...support,
    state: stateCode,
    state_name: stateName,
    year: YEAR,
    household: {
      num_adults: numAdults,
      num_children: numChildren,
      earned_income: earnedMonthly * 12,
      unearned_income: unearnedMonthly * 12,
      total_income: (earnedMonthly + unearnedMonthly) * 12,
    },
    breakdown: {
      max_support_monthly: maxSupport,
      max_support_annual: maxSupport * 12,
      programs: support.programs,
    },
  }
}

export function generateHouseholdSizeData(
  stateData,
  numAdults,
  earnedMonthly,
  unearnedMonthly,
) {
  const data = []

  for (let children = 0; children <= 7; children += 1) {
    const support = lookupSupport(
      stateData,
      numAdults,
      children,
      earnedMonthly,
      unearnedMonthly,
    )

    data.push({
      children,
      householdSize: numAdults + children,
      label: String(numAdults + children),
      support_monthly: support.support_monthly,
    })
  }

  return data
}
