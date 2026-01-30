# Diam'o CRM - Button State Normalization Rules

## Rule: All Buttons Must Define Visible Base States

**One-line rule**: If a button looks "correct" only when hovered, the default state is wrong.

All buttons **must define a visible base state**. No button may rely on hover to become readable.

## Mandatory Button States

Every button variant must explicitly define in its **default (rest) state**:

- `background-color` - Must be visible, not transparent
- `border` - Must be defined for outline buttons
- `color` - Must have sufficient contrast
- `cursor` - Must be `pointer`

Hover, focus, and active states may **only adjust** these values; they must never introduce them for the first time.

## Prohibited Patterns

❌ **Transparent buttons without borders**
```css
/* BAD - Invisible until hover */
.btn {
  background: transparent;
  border: none;
}
```

❌ **Buttons that gain background only on hover**
```css
/* BAD - Only visible on hover */
.btn {
  background: transparent;
}
.btn:hover {
  background: var(--color-primary);
}
```

❌ **Relying on parent background for contrast**
```css
/* BAD - Depends on parent */
.btn {
  background: transparent;
  color: var(--color-text);
}
```

❌ **Hover-only affordance discovery**
```css
/* BAD - Interactive state only on hover */
.btn {
  opacity: 0.3;
}
.btn:hover {
  opacity: 1;
}
```

## Standard Button Contract

### Primary Button
```css
.btn-primary {
  background: var(--color-primary);
  border: 1px solid var(--color-primary);
  color: white;
  cursor: pointer;
}

.btn-primary:hover {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}

.btn-primary:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(30, 102, 208, 0.3);
}

.btn-primary:active {
  background: var(--color-primary-dark);
  transform: translateY(1px);
}
```

### Secondary Button
```css
.btn-secondary {
  background: var(--color-surface);
  border: 2px solid var(--color-border-default);
  color: var(--color-text-primary);
  cursor: pointer;
}

.btn-secondary:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.btn-secondary:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(30, 102, 208, 0.3);
}
```

### Ghost/Outline Button
```css
.btn-ghost {
  background: transparent;
  border: 2px solid var(--color-primary);
  color: var(--color-primary);
  cursor: pointer;
}

.btn-ghost:hover {
  background: var(--color-primary);
  color: white;
}

.btn-ghost:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(30, 102, 208, 0.3);
}
```

### Danger Button
```css
.btn-danger {
  background: var(--color-error);
  border: 1px solid var(--color-error);
  color: white;
  cursor: pointer;
}

.btn-danger:hover {
  background: var(--color-error);
  opacity: 0.9;
}

.btn-danger:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(224, 49, 49, 0.3);
}
```

## Accessibility Requirements

### Touch Device Compatibility
A button must be clearly identifiable as interactive **before hover**, including on touch devices where hover does not exist.

### Contrast Requirements
- Minimum 4.5:1 contrast ratio between text and background
- Minimum 3:1 contrast ratio for large text (18pt+) and UI components
- Focus indicators must meet 3:1 contrast against surrounding content

### Touch Target Size
- Minimum 44x44px touch target
- Visual padding must not reduce effective touch area
- Margins should not interfere with adjacent touch targets

## Implementation Guidelines

### CSS Custom Properties Usage
```css
/* Use modernized color palette */
.btn {
  background: var(--color-primary);
  border: 1px solid var(--color-primary);
  color: white;
}

/* Hover adjustments only */
.btn:hover {
  background: var(--color-primary-hover);
}
```

### Component Implementation
```tsx
// GOOD - Explicit base state
<button 
  className="btn-primary"
  style={{
    backgroundColor: 'var(--color-primary)',
    border: '1px solid var(--color-primary)',
    color: 'white'
  }}
>
  Click me
</button>

// BAD - Missing base state
<button 
  className="btn-ghost"
  style={{
    background: 'transparent',
    border: 'none'
  }}
>
  Invisible button
</button>
```

### Testing Checklist
- [ ] Button is visible in default state
- [ ] Button has clear interactive affordance
- [ ] Hover state provides feedback without being required
- [ ] Focus state is clearly distinguishable
- [ ] Touch target meets 44px minimum
- [ ] Contrast ratios meet WCAG AA standards
- [ ] Button works without hover (touch devices)

## Quality Assurance

### Visual Testing
- Test buttons in default state without hovering
- Verify all buttons are immediately identifiable
- Check consistency across all themes and modes
- Test on mobile devices without hover capability

### Automated Testing
- Lint rules to prevent transparent backgrounds without borders
- Contrast checking for all button states
- Touch target size validation
- Focus indicator visibility testing

### Review Process
- All button implementations must pass accessibility review
- Design system changes require button state validation
- New button variants must follow established patterns

## Benefits

✅ **Improved User Experience**: Buttons are immediately recognizable  
✅ **Better Accessibility**: Works for all users and devices  
✅ **Reduced Cognitive Load**: No discovery required for interaction  
✅ **Consistent Brand Experience**: Uniform interaction patterns  
✅ **Modern Appearance**: Professional, polished interface  
✅ **Touch-Friendly**: Optimized for mobile devices  
✅ **Reduced Errors**: Clear visual feedback prevents misclicks

This rule ensures that Diam'o CRM buttons provide a modern, accessible, and professional user experience across all devices and user abilities.