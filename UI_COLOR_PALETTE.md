# UI/UX Design System - Diam'o CRM (Modernized)

## Color Palette

### Core Brand Colors (Modernized)
- **Primary Blue**: `#1E66D0` (Main brand color - deeper, less saturated)
- **Primary Hover**: `#1A5BB8` (Hover states)
- **Primary Soft**: `#E7F0FF` (Subtle highlights)

### Neutral Foundation (Modernized)
- **App Background**: `#F9FAFB` (Clean background)
- **Surface**: `#FFFFFF` (White surface)
- **Surface Subtle**: `#F1F3F5` (Secondary panels)

### Semantic Colors (Modernized)
- **Success Green**: `#2F9E44` (Positive actions - desaturated)
- **Error Red**: `#E03131` (Error states - desaturated)
- **Warning Orange**: `#F08C00` (Warning states - modernized)
- **Info Blue**: `#1864AB` (Information)

### Text Colors (Modernized)
- **Primary Text**: `#1F2937` (Main text)
- **Secondary Text**: `#6B7280` (Secondary text)
- **Muted Text**: `#9CA3AF` (Disabled/muted text)

### Borders & Dividers (Modernized)
- **Border Subtle**: `#E5E7EB` (Subtle borders)
- **Border Default**: `#D1D5DB` (Default borders)
- **Focus Ring**: `rgba(30, 102, 208, 0.35)` (Focus states)

### Legacy Colors (Backward Compatibility)
- **Primary Original**: `#1C7ED6` (Legacy blue)
- **Success Original**: `#40C057` (Legacy green)
- **Error Original**: `#FA5252` (Legacy red)
- **Warning Original**: `#FFD43B` (Legacy yellow)

## Typography

### Font Family
- **Primary Font**: Inter (Google Fonts)
- **Fallback**: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif

### Font Sizes (Modernized)
- **H1**: 2rem (32px) - Main headings
- **H2**: 1.875rem (30px) - Section headings
- **H3**: 1.5rem (24px) - Subsection headings
- **H4**: 1.25rem (20px) - Content headings
- **H5**: 1.125rem (18px) - Small headings
- **H6**: 1rem (16px) - Minor headings
- **Body**: 0.9375rem (15px) - Main body text
- **Small**: 0.8125rem (13px) - Secondary text
- **XSmall**: 0.75rem (12px) - Captions, labels

### Line Heights
- **Tight**: 1.25
- **Snug**: 1.375
- **Normal**: 1.5
- **Relaxed**: 1.625
- **Loose**: 2

## Spacing System

### Spacing Scale
- **XS**: 0.25rem (4px)
- **SM**: 0.5rem (8px)
- **MD**: 1rem (16px)
- **LG**: 1.5rem (24px)
- **XL**: 2rem (32px)
- **2XL**: 3rem (48px)
- **3XL**: 4rem (64px)

## Border Radius (Modernized)

### Radius Scale
- **SM**: 6px
- **MD**: 10px
- **LG**: 14px
- **XL**: 18px
- **Full**: 9999px (Circular)

## Shadows (Modernized)

### Shadow Scale
- **None**: none (Default - no shadows)
- **SM**: 0 1px 2px rgba(0,0,0,0.04) (Subtle)
- **MD**: 0 4px 12px rgba(0,0,0,0.06) (Moderate)
- **LG**: 0 10px 15px -3px rgba(0,0,0,0.1) (Elevated)
- **XL**: 0 20px 25px -5px rgba(0,0,0,0.1) (Dramatic)

## Transitions (Modernized)

### Transition Scale
- **Fast**: 120ms ease-out
- **Normal**: 200ms ease-out
- **Slow**: 350ms ease-in-out

## Design Philosophy (New)

### Layout Style
- **Flat layouts** - Minimal visual noise
- **Clear sections** - Strong visual separation using borders
- **Information density** - Slightly smaller body text (15px) for better data display
- **Operational focus** - Long-session friendly interfaces

### Motion Guidelines
- **Subtle movement** - No scale-on-hover, no dramatic effects
- **Opacity and position** - Preferred animation properties
- **Respect user preferences** - Strict `prefers-reduced-motion` compliance

### Shadow Philosophy
- **Shadows are rare** - Borders do most of the work
- **Minimal elevation** - Only use when absolutely necessary
- **Functional over decorative** - Purpose-driven shadows only

### Component Design
- **Calm and trustworthy** - Avoid flashy or decorative elements
- **Operational efficiency** - Designed for business workflows
- **Consistent patterns** - Reusable, predictable components

### Accessibility (Enhanced)
- **WCAG AA minimum** - Always meet accessibility standards
- **No color-only indicators** - Always include text or icons
- **Touch targets** - 44px minimum where applicable
- **Focus visibility** - Always maintain clear focus indicators

### Brand Expression
Diam'o CRM should feel:
- **Calm** - No jarring colors or animations
- **Trustworthy** - Professional, reliable appearance
- **Operational** - Business-focused, task-oriented
- **Long-session friendly** - Comfortable for extended use

**Not:**
- Flashy or decorative
- Animated for animation's sake
- Cluttered or visually noisy

## Component States

### Button States
- **Primary**: Linear gradient blue with subtle shadow
- **Secondary**: Light blue with border
- **Hover**: Scale up slightly, enhanced shadow
- **Active**: Pressed effect
- **Loading**: Shimmer animation

### Form States
- **Default**: Light gray border
- **Focus**: Blue border with glow effect
- **Hover**: Slightly darker border
- **Error**: Red border with error styling

### Card States
- **Default**: White background, subtle shadow
- **Hover**: Slight lift, enhanced shadow
- **Interactive**: Border change on hover
- **Elevated**: Higher shadow for important content

## Responsive Design

### Breakpoints
- **Mobile**: < 768px
- **Tablet**: 769px - 1024px
- **Desktop**: > 1024px

### Mobile Optimizations
- Touch targets: minimum 44px height
- Font size: 16px for inputs (iOS zoom prevention)
- Spacing: increased for touch interaction
- Navigation: mobile-first sidebar

## Accessibility Features

### High Contrast Support
- Automatic border adjustments
- Text color optimization
- Enhanced contrast ratios

### Reduced Motion Support
- All animations disabled when `prefers-reduced-motion: reduce`
- Instant transitions
- No hover effects

### Focus Management
- Clear focus rings
- Keyboard navigation support
- Logical tab order

## Design Patterns

### Loading States
- Skeleton loading with shimmer effect
- Animated dots for small loaders
- Full page loading overlays

### Feedback States
- Success: Green color scheme with checkmark
- Error: Red color scheme with warning icon
- Warning: Yellow color scheme with alert icon

### Interactive Elements
- Subtle hover effects
- Smooth transitions
- Clear visual feedback
- Touch-friendly sizing

### Data Visualization
- Clean chart containers
- Consistent color schemes
- Responsive chart sizing
- Clear data labels

## Brand Consistency

### Color Usage
- Primary blue for main actions and highlights
- Green for success states and confirmations
- Red for errors and destructive actions
- Yellow for warnings and attention

### Typography Usage
- Inter font family throughout
- Consistent heading hierarchy
- Proper line height for readability
- Clear text hierarchy

### Spacing Consistency
- Consistent padding and margins
- Proportional spacing scale
- Balanced white space
- Grid-based layouts

This design system ensures consistent, accessible, and beautiful user interfaces across the Diam'o CRM application.