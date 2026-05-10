import { describe, expect, it } from 'vitest'
import { BillingCycle } from '@prisma/client'
import { computeAmount, computePeriodMonths, computeDiscount } from './saas-billing'

describe('saas-billing helpers', () => {
  it('uses annual pricing for school-year billing when annualPrice is configured', () => {
    expect(
      computeAmount(
        { monthlyPrice: 0, annualPrice: 100_000, schoolYearMonths: 9 },
        BillingCycle.SCHOOL_YEAR,
        3,
        0
      )
    ).toBe(300_000)
  })

  it('falls back to monthly * schoolYearMonths when annual pricing is not configured', () => {
    expect(
      computeAmount(
        { monthlyPrice: 20_000, annualPrice: 0, schoolYearMonths: 9 },
        BillingCycle.SCHOOL_YEAR,
        2,
        0
      )
    ).toBe(360_000)
  })

  it('applies multi-year discounts to annual subscriptions', () => {
    expect(
      computeDiscount(
        {
          yearDiscountPercent: 0,
          twoYearDiscountPercent: 5,
          fiveYearDiscountPercent: 10,
          tenYearDiscountPercent: 15
        },
        5,
        BillingCycle.ANNUAL
      )
    ).toBe(10)
  })

  it('computes school-year periods using the configured number of months', () => {
    expect(computePeriodMonths(BillingCycle.SCHOOL_YEAR, 3, 9)).toBe(27)
  })
})
