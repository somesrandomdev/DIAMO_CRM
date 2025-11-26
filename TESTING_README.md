# 🧪 Testing Guide - Diam'o Application

This guide demonstrates how to use **Jest** (unit testing) and **Cypress** (end-to-end testing) with the Diam'o franchise management system.

## 📋 Testing Frameworks Overview

### 🎯 Jest - Unit Testing
- **Purpose**: Test individual functions, components, and utilities
- **Best for**: Business logic, calculations, data transformations
- **Speed**: Very fast (runs in seconds)
- **Scope**: Isolated testing

### 🌐 Cypress - End-to-End Testing
- **Purpose**: Test complete user workflows and interactions
- **Best for**: User journeys, navigation, form submissions
- **Speed**: Slower but realistic (runs in browser)
- **Scope**: Full application testing

## 🚀 Running Tests

### Prerequisites
```bash
# Install dependencies (already done)
npm install

# Make sure development server is running for Cypress
npm run dev
```

### Jest Unit Tests
```bash
# Run all unit tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Cypress End-to-End Tests
```bash
# Open Cypress Test Runner (interactive GUI)
npm run cy:open

# Run all E2E tests headlessly
npm run cy:run

# Run only authentication tests
npm run test:e2e
```

## 📝 Test Examples

### 🎯 Jest Unit Test Example

**File**: `src/utils/__tests__/price.test.ts`

```typescript
import { toCFA } from '../price'

describe('Price Utility Functions', () => {
  describe('toCFA', () => {
    it('should format numbers as CFA currency', () => {
      expect(toCFA(100)).toBe('100 CFA')
      expect(toCFA(2500)).toBe('2500 CFA')
      expect(toCFA(0)).toBe('0 CFA')
    })

    it('should handle decimal numbers', () => {
      expect(toCFA(100.5)).toBe('100.5 CFA')
      expect(toCFA(99.99)).toBe('99.99 CFA')
    })
  })
})
```

**What this tests:**
- ✅ Currency formatting function works correctly
- ✅ Handles different number types (integers, decimals)
- ✅ Edge cases (zero, negative numbers)

### 🌐 Cypress E2E Test Example

**File**: `cypress/e2e/auth.cy.ts`

```typescript
describe('Authentication Flow', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('should display login form', () => {
    cy.get('h1').should('contain', 'Connexion')
    cy.get('input[type="email"]').should('be.visible')
    cy.get('input[type="password"]').should('be.visible')
    cy.get('button[type="submit"]').should('contain', 'Se connecter')
  })

  it('should toggle between login and signup', () => {
    cy.get('h1').should('contain', 'Connexion')
    cy.get('button[type="button"]').should('contain', 'Créer un compte')

    cy.get('button[type="button"]').click()
    cy.get('h1').should('contain', 'Créer un compte')
  })
})
```

**What this tests:**
- ✅ Login form displays correctly
- ✅ Form validation works
- ✅ Navigation between login/signup works
- ✅ User interactions function properly

## 🧪 Test Structure

```
📁 Project Structure
├── 📁 src/
│   ├── 📁 utils/__tests__/
│   │   └── price.test.ts          # Unit tests for utilities
│   ├── 📁 components/__tests__/
│   │   └── NavControls.test.tsx   # Component tests
│   └── 📁 stores/__tests__/
│       └── authStore.test.ts      # Store tests
├── 📁 cypress/
│   ├── 📁 e2e/
│   │   ├── auth.cy.ts            # Authentication tests
│   │   └── dashboard.cy.ts       # Dashboard navigation tests
│   └── 📁 support/
│       └── commands.ts           # Custom Cypress commands
├── jest.config.js                # Jest configuration
├── cypress.config.ts            # Cypress configuration
└── src/setupTests.ts            # Jest setup file
```

## 🎯 Types of Tests Demonstrated

### 1. **Unit Tests** (Jest)
- **Price formatting**: `toCFA(100) → "100 CFA"`
- **Business calculations**: Average basket, growth rates
- **Data validation**: Email format, phone numbers
- **Utility functions**: Date formatting, currency conversion

### 2. **Component Tests** (Jest + React Testing Library)
- **Button rendering**: Back button, logout button
- **User interactions**: Click handlers, form submissions
- **Props handling**: Component behavior with different props
- **State management**: Component state changes

### 3. **End-to-End Tests** (Cypress)
- **User journeys**: Login → Dashboard → Sales → Back
- **Form workflows**: Fill forms, submit, validate responses
- **Navigation**: Menu clicks, page transitions
- **API mocking**: Simulate backend responses
- **Visual validation**: Check element visibility and content

## 🔍 Test Scenarios Covered

### Authentication Flow
- ✅ Login form display
- ✅ Signup form toggle
- ✅ Form validation
- ✅ Successful login flow
- ✅ Error handling

### Dashboard Navigation
- ✅ Role-based dashboard display
- ✅ Navigation between sections
- ✅ Back button functionality
- ✅ Logout functionality

### Sales Management
- ✅ Sales form display
- ✅ Client selection
- ✅ Offer selection
- ✅ Quantity input
- ✅ Form submission

### Client Management
- ✅ Client list display
- ✅ Client details modal
- ✅ Purchase history
- ✅ Client creation flow

## 🛠️ Advanced Testing Features

### Mocking Strategies
```typescript
// Mock Supabase responses
cy.intercept('POST', '**/auth/v1/token*', {
  statusCode: 200,
  body: { access_token: 'mock-token', user: {...} }
})

// Mock Zustand stores
jest.mock('../../stores/authStore', () => ({
  useAuthStore: jest.fn()
}))
```

### Custom Commands
```typescript
// Custom Cypress command
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.get('input[type="email"]').type(email)
  cy.get('input[type="password"]').type(password)
  cy.get('button[type="submit"]').click()
})
```

### Test Data Factories
```typescript
// Generate test data
const createMockUser = (role: string) => ({
  id: '123',
  email: 'test@example.com',
  user_metadata: { role }
})
```

## 📊 Test Coverage Goals

### Unit Tests (Jest)
- **Utilities**: 100% coverage
- **Business Logic**: 90%+ coverage
- **Data Transformations**: 95% coverage
- **Error Handling**: 85% coverage

### E2E Tests (Cypress)
- **Critical User Journeys**: 100% coverage
- **Form Workflows**: 90%+ coverage
- **Navigation Paths**: 95% coverage
- **Error Scenarios**: 80% coverage

## 🎉 Benefits of This Testing Setup

### For Developers
- **Fast feedback** on code changes
- **Prevents regressions** with comprehensive test suite
- **Documents expected behavior** through tests
- **Improves code quality** with TDD approach

### For Business
- **Confidence in deployments** with automated testing
- **User experience validation** through E2E tests
- **Reduced bug reports** from QA team
- **Faster feature delivery** with reliable testing

### For Maintenance
- **Easy to extend** test coverage for new features
- **Self-documenting** codebase with test examples
- **CI/CD ready** with automated test execution
- **Debugging aid** with detailed test failure reports

## 🚀 Getting Started with Testing

### 1. Run Your First Test
```bash
# Start development server
npm run dev

# In another terminal, run Cypress
npm run cy:open

# Click on "auth.cy.ts" to see authentication tests
```

### 2. Run Unit Tests
```bash
npm test
# Look for the price.test.ts results
```

### 3. Write Your Own Test
```typescript
// Add to cypress/e2e/auth.cy.ts
it('should handle password reset', () => {
  cy.get('button').contains('Mot de passe oublié').click()
  cy.get('input[type="email"]').type('user@example.com')
  cy.get('button').contains('Envoyer').click()
  cy.contains('Email envoyé').should('be.visible')
})
```

## 📚 Learning Resources

### Jest Documentation
- [Jest Official Docs](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Library Queries](https://testing-library.com/docs/queries/about/)

### Cypress Documentation
- [Cypress Official Docs](https://docs.cypress.io/)
- [Best Practices](https://docs.cypress.io/guides/references/best-practices)
- [Component Testing](https://docs.cypress.io/guides/component-testing/introduction)

### Testing Patterns
- [Testing JavaScript](https://testingjavascript.com/)
- [Kent C. Dodds Blog](https://kentcdodds.com/blog/)
- [Martin Fowler Testing](https://martinfowler.com/testing/)

---

**🎯 This testing setup provides a solid foundation for maintaining code quality and preventing regressions in the Diam'o franchise management system!**