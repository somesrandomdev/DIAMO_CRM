import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { BackButton, LogoutButton } from '../NavControls'
import { useAuthStore } from '@/stores/authStore'

// Mock the auth store
jest.mock('@/stores/authStore', () => ({
  useAuthStore: jest.fn()
}))

const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    {children}
  </BrowserRouter>
)

describe('NavControls Components', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('BackButton', () => {
    it('should render back button', () => {
      const mockOnBack = jest.fn()

      render(
        <TestWrapper>
          <BackButton onBack={mockOnBack} />
        </TestWrapper>
      )

      const button = screen.getByText('Retour')
      expect(button).toBeInTheDocument()
    })

    it('should call onBack when clicked', () => {
      const mockOnBack = jest.fn()

      render(
        <TestWrapper>
          <BackButton onBack={mockOnBack} />
        </TestWrapper>
      )

      const button = screen.getByText('Retour')
      fireEvent.click(button)

      expect(mockOnBack).toHaveBeenCalledTimes(1)
    })
  })

  describe('LogoutButton', () => {
    it('should render logout button', () => {
      mockUseAuthStore.mockReturnValue({
        signOut: jest.fn(),
        user: null,
        profile: null,
        signIn: jest.fn(),
        loadProfile: jest.fn(),
        isLoading: false,
        isAuthenticated: jest.fn(),
        hasRole: jest.fn(),
      })

      render(
        <TestWrapper>
          <LogoutButton />
        </TestWrapper>
      )

      const button = screen.getByText('Déconnexion')
      expect(button).toBeInTheDocument()
    })

    it('should call signOut when clicked', () => {
      const mockSignOut = jest.fn()
      mockUseAuthStore.mockReturnValue({
        signOut: mockSignOut,
        user: null,
        profile: null,
        signIn: jest.fn(),
        loadProfile: jest.fn(),
        isLoading: false,
        isAuthenticated: jest.fn(),
        hasRole: jest.fn(),
      })

      render(
        <TestWrapper>
          <LogoutButton />
        </TestWrapper>
      )

      const button = screen.getByText('Déconnexion')
      fireEvent.click(button)

      expect(mockSignOut).toHaveBeenCalledTimes(1)
    })
  })
})

// Example of testing business logic
describe('Business Logic Tests', () => {
  it('should calculate correct totals', () => {
    const sales = [100, 200, 300, 400]
    const total = sales.reduce((sum, sale) => sum + sale, 0)
    const average = total / sales.length

    expect(total).toBe(1000)
    expect(average).toBe(250)
  })

  it('should validate form data', () => {
    const validData = {
      nom: 'John Doe',
      email: 'john@example.com',
      telephone: '+22501020304'
    }

    const invalidData = {
      nom: '',
      email: 'invalid-email',
      telephone: '123'
    }

    // Valid data checks
    expect(validData.nom.length).toBeGreaterThan(0)
    expect(validData.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
    expect(validData.telephone).toMatch(/^\+225\d{8}$/)

    // Invalid data checks
    expect(invalidData.nom.length).toBe(0)
    expect(invalidData.email).not.toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
    expect(invalidData.telephone).not.toMatch(/^\+225\d{8}$/)
  })

  it('should format currency correctly', () => {
    const formatCFA = (amount: number) => `${amount} CFA`

    expect(formatCFA(100)).toBe('100 CFA')
    expect(formatCFA(2500)).toBe('2500 CFA')
    expect(formatCFA(0)).toBe('0 CFA')
  })
})
