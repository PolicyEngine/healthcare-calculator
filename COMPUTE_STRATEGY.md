# Compute Strategy

The TANF calculator works well as a static grid because the input space is small:

- state
- county group for a few states
- adults
- children
- earned income
- unearned income

Healthcare is different. A realistic ACA + Medicaid + CHIP calculator depends on:

- exact ages, because ACA premiums and Medicaid child/adult categories depend on age
- ESI status, and often whether disqualifying ESI is merely offered
- immigration status
- pregnancy / postpartum status
- county or ZIP-based rating areas for ACA pricing in some states
- tax-unit MAGI

That means a full TANF-style precompute for arbitrary households will blow up quickly. Even before pregnancy and immigration, exact ages and ESI flags multiply the state space too much to make a single static grid practical.

## Recommendation

Use a hybrid runtime model:

1. Single-household calculation should be runtime.
2. State comparison should also be runtime, but cached by an input signature.
3. Income charts should be generated on demand for one household profile at a coarse MAGI step.
4. Only metadata should be precomputed statically:
   state list, counties, rating areas, ZIP-to-rating-area helpers, and perhaps common household presets.

## Suggested v1 Inputs

- state
- county or ZIP code when needed for rating area
- household members with:
  age
  role (`head`, `spouse`, `dependent`)
  `has_esi`
  `offered_aca_disqualifying_esi`
  `immigration_status`
  `is_pregnant`
- household `tax_unit_magi`

## Outputs To Use From PolicyEngine

- `aca_ptc`
- `is_aca_ptc_eligible`
- `is_medicaid_eligible`
- `is_chip_eligible`
- `medicaid_cost`
- `chip`
- `healthcare_benefit_value`
- `slcsp`
- `aca_magi_fraction`

## What’s In This Repo Now

The first backend-oriented piece is [scripts/healthcare_calculator.py](/Users/daphnehansell/Documents/GitHub/healthcare-calculator/scripts/healthcare_calculator.py). It is a reusable PolicyEngine adapter that:

- builds a person-level household situation
- calculates one household
- can sweep all states for a comparison map
- can sweep MAGI for an income chart

## Immediate Next Step

Replace the frontend mock `dataLookup.js` layer with a runtime API contract built on top of `scripts/healthcare_calculator.py`, while expanding the UI to collect ages and ESI inputs.
