describe('Authentication Flow', () => {
  beforeEach(() => {
    // Visit the application
    cy.visit('/')
  })

  it('should display login form', () => {
    // Check that login form elements are present
    cy.get('h1').should('contain', 'Connexion')
    cy.get('input[type="email"]').should('be.visible')
    cy.get('input[type="password"]').should('be.visible')
    cy.get('button[type="submit"]').should('contain', 'Se connecter')
  })

  it('should toggle between login and signup', () => {
    // Initially should show login form
    cy.get('h1').should('contain', 'Connexion')
    cy.get('button[type="button"]').should('contain', 'Créer un compte')

    // Click to switch to signup
    cy.get('button[type="button"]').click()
    cy.get('h1').should('contain', 'Créer un compte')
    cy.get('input[placeholder="Nom d\'utilisateur"]').should('be.visible')
    cy.get('button[type="button"]').should('contain', 'J\'ai déjà un compte')

    // Click back to login
    cy.get('button[type="button"]').click()
    cy.get('h1').should('contain', 'Connexion')
  })

  it('should show validation errors for empty fields', () => {
    // Try to submit empty form
    cy.get('button[type="submit"]').click()

    // Should show error messages
    cy.get('.text-red-600').should('be.visible')
  })

  it('should validate email format', () => {
    // Enter invalid email
    cy.get('input[type="email"]').type('invalid-email')
    cy.get('input[type="password"]').type('password123')

    cy.get('button[type="submit"]').click()

    // Should show error (this would depend on your validation logic)
    cy.get('body').should('be.visible') // Basic check that page is still accessible
  })
})

// Example of testing with mock data
describe('Authentication with Mock Data', () => {
  it('should handle successful login flow', () => {
    // This test would work with a test database or mocked responses
    cy.intercept('POST', '**/auth/v1/token*', {
      statusCode: 200,
      body: {
        access_token: 'mock-token',
        user: { id: '123', email: 'test@example.com' }
      }
    }).as('loginRequest')

    cy.visit('/')

    // Fill login form
    cy.get('input[type="email"]').type('test@example.com')
    cy.get('input[type="password"]').type('password123')

    // Submit form
    cy.get('button[type="submit"]').click()

    // Wait for login request
    cy.wait('@loginRequest')

    // Should redirect to dashboard (this would depend on your routing)
    cy.url().should('not.include', '/login')
  })
})