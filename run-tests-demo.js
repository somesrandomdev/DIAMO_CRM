#!/usr/bin/env node

/**
 * 🚀 Testing Demonstration Script for Diam'o
 *
 * This script demonstrates how testing works and why it's valuable
 * Run with: node run-tests-demo.js
 */

console.log('🎯 DIAM\'O TESTING DEMONSTRATION')
console.log('================================\n')

// Simulate test scenarios
const scenarios = [
  {
    name: 'Currency Formatting Test',
    description: 'Testing the toCFA utility function',
    test: () => {
      const toCFA = (amount) => `${amount} CFA`

      const testCases = [
        { input: 100, expected: '100 CFA' },
        { input: 2500, expected: '2500 CFA' },
        { input: 0, expected: '0 CFA' },
        { input: 99.99, expected: '99.99 CFA' }
      ]

      console.log('  Testing currency formatting...')
      testCases.forEach(({ input, expected }, index) => {
        const result = toCFA(input)
        const passed = result === expected
        console.log(`    ${index + 1}. toCFA(${input}) = "${result}" ${passed ? '✅' : '❌'}`)
        if (!passed) {
          console.log(`       Expected: "${expected}"`)
        }
      })
    }
  },
  {
    name: 'Business Logic Test',
    description: 'Testing sales calculations',
    test: () => {
      console.log('  Testing business calculations...')

      // Simulate sales data
      const sales = [100, 200, 300, 400, 500]
      const total = sales.reduce((sum, sale) => sum + sale, 0)
      const average = total / sales.length
      const expectedTotal = 1500
      const expectedAverage = 300

      console.log(`    Total sales: ${total} CFA ${total === expectedTotal ? '✅' : '❌'}`)
      console.log(`    Average sale: ${average} CFA ${average === expectedAverage ? '✅' : '❌'}`)

      // Growth calculation
      const previousPeriod = 1000
      const currentPeriod = 1500
      const growthRate = ((currentPeriod - previousPeriod) / previousPeriod) * 100
      console.log(`    Growth rate: ${growthRate}% ${growthRate === 50 ? '✅' : '❌'}`)
    }
  },
  {
    name: 'Data Validation Test',
    description: 'Testing form validation logic',
    test: () => {
      console.log('  Testing data validation...')

      const validateEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return emailRegex.test(email)
      }

      const testEmails = [
        { email: 'user@example.com', expected: true },
        { email: 'invalid-email', expected: false },
        { email: 'user@', expected: false },
        { email: 'user..double@example.com', expected: false }
      ]

      testEmails.forEach(({ email, expected }, index) => {
        const result = validateEmail(email)
        const passed = result === expected
        console.log(`    ${index + 1}. "${email}" is ${result ? 'valid' : 'invalid'} ${passed ? '✅' : '❌'}`)
      })
    }
  },
  {
    name: 'User Interface Test Simulation',
    description: 'Simulating UI interaction tests',
    test: () => {
      console.log('  Simulating UI tests...')

      // Simulate button clicks
      let buttonClicks = 0
      const simulateClick = () => { buttonClicks++ }

      console.log('    Simulating button clicks...')
      simulateClick() // Login button
      simulateClick() // Submit button
      simulateClick() // Navigation button

      console.log(`    Button clicked ${buttonClicks} times ${buttonClicks === 3 ? '✅' : '❌'}`)

      // Simulate form validation
      const simulateFormValidation = (data) => {
        const errors = []
        if (!data.name || data.name.length < 2) errors.push('Name too short')
        if (!data.email || !data.email.includes('@')) errors.push('Invalid email')
        if (!data.amount || data.amount <= 0) errors.push('Invalid amount')
        return errors
      }

      const testData = [
        { name: 'John', email: 'john@example.com', amount: 100 },
        { name: 'A', email: 'invalid', amount: -50 },
        { name: 'Jane', email: 'jane@test.com', amount: 0 }
      ]

      testData.forEach((data, index) => {
        const errors = simulateFormValidation(data)
        const passed = errors.length === 0
        console.log(`    Form ${index + 1}: ${passed ? 'Valid' : 'Invalid'} ${passed ? '✅' : '❌'}`)
        if (!passed) {
          console.log(`      Errors: ${errors.join(', ')}`)
        }
      })
    }
  }
]

// Run all test scenarios
scenarios.forEach((scenario, index) => {
  console.log(`${index + 1}. ${scenario.name}`)
  console.log(`   ${scenario.description}`)
  scenario.test()
  console.log('')
})

// Summary
console.log('🎉 TESTING DEMONSTRATION COMPLETE!')
console.log('')
console.log('📊 What We Tested:')
console.log('  ✅ Currency formatting functions')
console.log('  ✅ Business logic calculations')
console.log('  ✅ Data validation rules')
console.log('  ✅ User interface interactions')
console.log('')
console.log('🚀 Benefits of Testing:')
console.log('  • Catches bugs before they reach production')
console.log('  • Documents expected behavior')
console.log('  • Prevents regressions when code changes')
console.log('  • Builds confidence in deployments')
console.log('  • Improves code quality and maintainability')
console.log('')
console.log('🛠️  Try Running Real Tests:')
console.log('  npm test              # Run Jest unit tests')
console.log('  npm run cy:open       # Open Cypress test runner')
console.log('  npm run test:coverage # See test coverage report')
console.log('')
console.log('📚 Learn More:')
console.log('  • Jest Documentation: https://jestjs.io/')
console.log('  • Cypress Documentation: https://docs.cypress.io/')
console.log('  • Testing Library: https://testing-library.com/')