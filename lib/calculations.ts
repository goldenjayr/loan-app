/**
 * Calculate simple interest
 * Formula: I = P * R * T
 * P = Principal, R = Rate (annual), T = Time (in years)
 */
export function calculateSimpleInterest(
  principal: number,
  annualRate: number,
  days: number
): number {
  const years = days / 365
  return principal * (annualRate / 100) * years
}

/**
 * Calculate compound interest
 * Formula: A = P(1 + r/n)^(nt)
 * where A = final amount, P = principal, r = annual rate, n = compounding periods per year, t = time in years
 */
export function calculateCompoundInterest(
  principal: number,
  annualRate: number,
  days: number,
  compoundingPeriodsPerYear: number = 12 // Monthly by default
): number {
  const years = days / 365
  const rate = annualRate / 100
  const amount = principal * Math.pow(1 + rate / compoundingPeriodsPerYear, compoundingPeriodsPerYear * years)
  return amount - principal // Return only the interest part
}

/**
 * Calculate monthly payment using standard amortization formula
 * Formula: M = P[r(1+r)^n]/[(1+r)^n-1]
 * P = principal, r = monthly rate, n = number of months
 */
export function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  months: number
): number {
  const monthlyRate = annualRate / 100 / 12
  
  if (monthlyRate === 0) {
    return principal / months
  }
  
  const numerator = monthlyRate * Math.pow(1 + monthlyRate, months)
  const denominator = Math.pow(1 + monthlyRate, months) - 1
  
  return principal * (numerator / denominator)
}

/**
 * Calculate accrued interest up to a specific date
 */
export function calculateAccruedInterest(
  principal: number,
  annualRate: number,
  startDate: Date,
  endDate: Date,
  interestType: 'simple' | 'compound' = 'simple'
): number {
  const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  
  if (interestType === 'simple') {
    return calculateSimpleInterest(principal, annualRate, daysDiff)
  } else {
    return calculateCompoundInterest(principal, annualRate, daysDiff)
  }
}

/**
 * Calculate penalty amount based on daily rate and overdue days
 */
export function calculatePenalty(
  principal: number,
  penaltyPerDay: number,
  overduedays: number
): number {
  return principal * penaltyPerDay * overduedays
}

/**
 * Calculate remaining balance using straight-line method
 */
export function calculateRemainingBalance(
  loanAmount: number,
  monthlyPayment: number,
  monthsPaid: number
): number {
  return Math.max(0, loanAmount - monthlyPayment * monthsPaid)
}

/**
 * Generate amortization schedule
 */
export function generateAmortizationSchedule(
  principal: number,
  annualRate: number,
  months: number,
  startDate: Date = new Date()
): AmortizationScheduleEntry[] {
  const monthlyPayment = calculateMonthlyPayment(principal, annualRate, months)
  const monthlyRate = annualRate / 100 / 12
  const schedule: AmortizationScheduleEntry[] = []
  
  let balance = principal
  let currentDate = new Date(startDate)
  
  for (let month = 1; month <= months; month++) {
    const interestPayment = balance * monthlyRate
    const principalPayment = monthlyPayment - interestPayment
    balance -= principalPayment
    
    // Add one month to the current date
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, currentDate.getDate())
    
    schedule.push({
      month,
      paymentDate: new Date(currentDate),
      paymentAmount: monthlyPayment,
      principalPayment,
      interestPayment,
      balance: Math.max(0, balance),
    })
  }
  
  return schedule
}

export interface AmortizationScheduleEntry {
  month: number
  paymentDate: Date
  paymentAmount: number
  principalPayment: number
  interestPayment: number
  balance: number
}
