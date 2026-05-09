const YEAR = 2026
const DEFAULT_MAGI = 35000
const DEFAULT_CHILD_AGE = 8

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

const DEFAULT_ADULTS = [
  { age: 40, has_esi: false, is_pregnant: false, immigration_status: 'Citizen' },
  { age: 38, has_esi: false, is_pregnant: false, immigration_status: 'Citizen' },
]

const buildChild = (age = DEFAULT_CHILD_AGE, index = 0) => ({
  age,
  immigration_status: 'Citizen',
  id: `child_${index + 1}`,
})

const buildAdult = (adult = {}, index = 0) => ({
  age: Number(adult.age) || DEFAULT_ADULTS[index]?.age || DEFAULT_ADULTS[0].age,
  has_esi: Boolean(adult.has_esi),
  is_pregnant: Boolean(adult.is_pregnant),
  immigration_status: adult.immigration_status || 'Citizen',
})

const resizeAdults = (adults, count) => Array.from(
  { length: count },
  (_, index) => buildAdult(adults[index], index),
)

const resizeChildren = (children, count) => {
  const fallbackAge = Number(children[children.length - 1]?.age) || DEFAULT_CHILD_AGE

  return Array.from({ length: count }, (_, index) => ({
    age: Number(children[index]?.age) || fallbackAge,
    immigration_status: children[index]?.immigration_status || 'Citizen',
    id: `child_${index + 1}`,
  }))
}

const parseErrorMessage = async (response) => {
  try {
    const payload = await response.json()
    return payload.error || `Request failed with status ${response.status}`
  } catch {
    return `Request failed with status ${response.status}`
  }
}

const postJson = async (path, payload) => {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  return response.json()
}

export function createInitialInputs() {
  return {
    tax_unit_magi: DEFAULT_MAGI,
    adults: resizeAdults(DEFAULT_ADULTS, 2),
    children: [buildChild(DEFAULT_CHILD_AGE, 0)],
  }
}

export function normalizeInputs(inputs) {
  const adults = resizeAdults(inputs.adults || DEFAULT_ADULTS, Math.min(2, Math.max(1, inputs.adults?.length || 1)))
  const children = resizeChildren(inputs.children || [], Math.min(7, Math.max(0, inputs.children?.length || 0)))

  return {
    ...inputs,
    year: YEAR,
    tax_unit_magi: Number(inputs.tax_unit_magi) || 0,
    adults,
    children,
  }
}

export function buildHouseholdPayload(inputs, stateCode = inputs.state) {
  const normalized = normalizeInputs(inputs)

  return {
    state: stateCode,
    year: normalized.year,
    tax_unit_magi: normalized.tax_unit_magi,
    people: [
      ...normalized.adults.map((adult, index) => ({
        id: index === 0 ? 'adult_1' : 'adult_2',
        role: index === 0 ? 'head' : 'spouse',
        age: adult.age,
        has_esi: adult.has_esi,
        offered_aca_disqualifying_esi: adult.has_esi,
        is_pregnant: adult.is_pregnant,
        immigration_status: adult.immigration_status || 'Citizen',
        has_itin: true,
      })),
      ...normalized.children.map((child, index) => ({
        id: `child_${index + 1}`,
        role: 'dependent',
        age: Number(child.age) || DEFAULT_CHILD_AGE,
        has_esi: false,
        offered_aca_disqualifying_esi: false,
        is_pregnant: false,
        immigration_status: child.immigration_status || 'Citizen',
        has_itin: true,
      })),
    ],
  }
}

export function buildScenarioInputs(baseInputs, scenario) {
  const normalized = normalizeInputs(baseInputs)

  return {
    ...normalized,
    tax_unit_magi: Number(scenario.tax_unit_magi ?? normalized.tax_unit_magi) || 0,
    adults: resizeAdults(
      normalized.adults,
      Math.min(2, Math.max(1, scenario.num_adults ?? normalized.adults.length)),
    ),
    children: resizeChildren(
      normalized.children,
      Math.min(7, Math.max(0, scenario.num_children ?? normalized.children.length)),
    ),
  }
}

export async function loadMetadata() {
  return {
    year: YEAR,
    states: STATE_INFO,
  }
}

export async function calculateStateResult(inputs, stateCode = inputs.state) {
  return postJson('/api/calculate', buildHouseholdPayload(inputs, stateCode))
}

export async function calculateAllStates(inputs) {
  return postJson('/api/states', buildHouseholdPayload(inputs))
}
