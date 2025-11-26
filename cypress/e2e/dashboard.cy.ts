describe('Dashboard Navigation', () => {
  beforeEach(() => {
    // Mock successful login
    cy.intercept('POST', '**/auth/v1/token*', {
      statusCode: 200,
      body: {
        access_token: 'mock-token',
        user: {
          id: '123',
          email: 'test@example.com',
          user_metadata: { role: 'commercial' }
        }
      }
    }).as('login')

    cy.intercept('GET', '**/auth/v1/user', {
      statusCode: 200,
      body: {
        user: {
          id: '123',
          email: 'test@example.com',
          user_metadata: { role: 'commercial' }
        }
      }
    }).as('getUser')

    cy.intercept('GET', '**/profiles*', {
      statusCode: 200,
      body: {
        id: '123',
        username: 'testuser',
        role: 'commercial',
        kiosque_id: 'kiosk-123'
      }
    }).as('getProfile')

    // Visit and login
    cy.visit('/')
    cy.get('input[type="email"]').type('test@example.com')
    cy.get('input[type="password"]').type('password123')
    cy.get('button[type="submit"]').click()
  })

  it('should display dashboard with navigation', () => {
    // Should redirect to dashboard
    cy.url().should('not.include', '/login')

    // Check dashboard elements
    cy.get('h1').should('contain', 'Tableau de bord')

    // Check navigation buttons
    cy.get('button').contains('Nouvelle vente').should('be.visible')
    cy.get('button').contains('Mes clients').should('be.visible')
    cy.get('button').contains('Mes statistiques').should('be.visible')
  })

  it('should navigate to sales page', () => {
    cy.get('button').contains('Nouvelle vente').click()

    // Should navigate to sales page
    cy.get('h2').should('contain', 'Nouvelle vente')

    // Check sales form elements
    cy.get('select').should('have.length.at.least', 2) // Client and offer selects
    cy.get('input[type="number"]').should('be.visible') // Quantity input
    cy.get('button').contains('Enregistrer').should('be.visible')
  })

  it('should navigate to clients page', () => {
    cy.get('button').contains('Mes clients').click()

    // Should navigate to clients page
    cy.get('h2').should('contain', 'Mes clients')

    // Check clients list
    cy.get('button').contains('Détails').should('be.visible')
  })

  it('should navigate to stats page', () => {
    cy.get('button').contains('Mes statistiques').click()

    // Should navigate to stats page
    cy.get('h2').should('contain', 'Analyses Détaillées')

    // Check stats elements
    cy.get('p').contains('Total Clients').should('be.visible')
    cy.get('p').contains('Total Ventes').should('be.visible')
    cy.get('p').contains('Chiffre d\'Affaires').should('be.visible')
  })

  it('should navigate back from subpages', () => {
    // Go to sales page
    cy.get('button').contains('Nouvelle vente').click()
    cy.get('h2').should('contain', 'Nouvelle vente')

    // Click back button
    cy.get('button').contains('← Retour').click()

    // Should return to dashboard
    cy.get('h1').should('contain', 'Tableau de bord')
  })
})

describe('Admin Dashboard', () => {
  beforeEach(() => {
    // Mock admin login
    cy.intercept('POST', '**/auth/v1/token*', {
      statusCode: 200,
      body: {
        access_token: 'mock-token',
        user: {
          id: '123',
          email: 'admin@example.com',
          user_metadata: { role: 'administrateur' }
        }
      }
    }).as('login')

    cy.intercept('GET', '**/auth/v1/user', {
      statusCode: 200,
      body: {
        user: {
          id: '123',
          email: 'admin@example.com',
          user_metadata: { role: 'administrateur' }
        }
      }
    }).as('getUser')

    cy.intercept('GET', '**/profiles*', {
      statusCode: 200,
      body: {
        id: '123',
        username: 'admin',
        role: 'administrateur',
        kiosque_id: 'kiosk-123'
      }
    }).as('getProfile')

    // Visit and login as admin
    cy.visit('/')
    cy.get('input[type="email"]').type('admin@example.com')
    cy.get('input[type="password"]').type('password123')
    cy.get('button[type="submit"]').click()
  })

  it('should display admin dashboard with all options', () => {
    // Check admin dashboard elements
    cy.get('h1').should('contain', 'Administration')

    // Check all admin buttons
    cy.get('button').contains('Vente').should('be.visible')
    cy.get('button').contains('Clients').should('be.visible')
    cy.get('button').contains('Offres').should('be.visible')
    cy.get('button').contains('Prix par kiosque').should('be.visible')
    cy.get('button').contains('Utilisateurs').should('be.visible')
    cy.get('button').contains('Kiosques').should('be.visible')
  })

  it('should navigate to offers management', () => {
    cy.get('button').contains('Offres').click()

    // Should navigate to offers page
    cy.get('h2').should('contain', 'Gérer les offres')

    // Check offers form
    cy.get('input[placeholder="Nom de l\'offre"]').should('be.visible')
    cy.get('input[placeholder="Volume (ml)"]').should('be.visible')
    cy.get('button').contains('Ajouter').should('be.visible')
  })
})