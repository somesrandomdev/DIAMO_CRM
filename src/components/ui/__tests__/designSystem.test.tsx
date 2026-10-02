import { render, screen } from '@testing-library/react'
import { Button } from '../button'
import { Input, Select, Textarea } from '../input'
import { KPICard } from '../kpi-card'
import { Label } from '../label'
import { Progress } from '../progress'

/**
 * Unified design system (ex pos-*): field screens keep 48px touch targets,
 * every colour comes from a token class, no arbitrary hex.
 */

const HEX = /#[0-9a-f]{3,6}\b/i

describe('ui — champs unifiés', () => {
  it('fieldSize="lg" : 48px et bordure 2px (écrans terrain)', () => {
    render(
      <>
        <Input fieldSize="lg" aria-label="nom" />
        <Select fieldSize="lg" aria-label="choix"><option>a</option></Select>
        <Textarea fieldSize="lg" aria-label="note" />
      </>
    )
    expect(screen.getByLabelText('nom')).toHaveClass('h-12', 'border-2')
    expect(screen.getByLabelText('choix')).toHaveClass('h-12', 'border-2')
    expect(screen.getByLabelText('note')).toHaveClass('min-h-12', 'h-auto')
  })

  it('taille par défaut inchangée (compacte sur desktop)', () => {
    render(<Input aria-label="nom" />)
    expect(screen.getByLabelText('nom')).toHaveClass('h-11', 'sm:h-9', 'border')
  })

  it('error : bordure rouge du token, sur les deux tailles', () => {
    render(
      <>
        <Input error aria-label="a" />
        <Input error fieldSize="lg" aria-label="b" />
      </>
    )
    expect(screen.getByLabelText('a')).toHaveClass('border-red')
    expect(screen.getByLabelText('b')).toHaveClass('border-red')
  })

  it('placeholder en text-tertiary (contraste AA), aucun hex', () => {
    render(<Input fieldSize="lg" aria-label="nom" />)
    const cls = screen.getByLabelText('nom').className
    expect(cls).toContain('placeholder:text-text-tertiary')
    expect(cls).not.toMatch(HEX)
  })
})

describe('ui — boutons', () => {
  it('size="touch" : 48px', () => {
    render(<Button variant="primary" size="touch">Valider</Button>)
    expect(screen.getByRole('button', { name: 'Valider' })).toHaveClass('h-12')
  })

  it('puce bascule = Button + aria-pressed', () => {
    render(
      <>
        <Button type="button" variant="primary" size="touch" aria-pressed>Actif</Button>
        <Button type="button" variant="outline" size="touch" aria-pressed={false}>Inactif</Button>
      </>
    )
    expect(screen.getByRole('button', { name: 'Actif', pressed: true })).toHaveClass('bg-primary')
    expect(screen.getByRole('button', { name: 'Inactif', pressed: false })).toHaveAttribute('type', 'button')
  })
})

describe('ui — Progress', () => {
  const fill = (container: HTMLElement) => container.querySelector('[style]') as HTMLElement

  it.each([
    [-10, '0%'],
    [0, '0%'],
    [42, '42%'],
    [150, '100%'],
  ])('valeur %p → largeur %p', (value, width) => {
    const { container } = render(<Progress value={value} />)
    expect(fill(container).style.width).toBe(width)
  })
})

describe('ui — KPICard et Label', () => {
  it('KPICard affiche la ligne de contexte (sub)', () => {
    render(<KPICard label="Ventes" value={12} sub="Ce mois" />)
    expect(screen.getByText('Ce mois')).toBeInTheDocument()
  })

  it('Label variant="caps"', () => {
    render(<Label variant="caps">Client</Label>)
    expect(screen.getByText('Client')).toHaveClass('uppercase', 'text-xs')
  })
})
