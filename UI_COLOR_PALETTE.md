# UI/UX Design System - Diam'o CRM v2 (Modernized)

## Color Palette

### Core Brand Colors
- **Primary Blue**: `#1E66D0` (Main brand color)
- **Primary Hover**: `#1A5BB8` (Hover states)
- **Primary Soft**: `#E7F0FF` (Subtle highlights)
- **Background**: `#F9FAFB` (App background)
- **Surface**: `#FFFFFF` (Card surfaces)
- **Surface Subtle**: `#F1F3F5` (Secondary panels)

### Semantic Colors (Desaturated)
- **Success Green**: `#2F9E44` (Positive actions)
- **Error Red**: `#E03131` (Error states)
- **Warning Orange**: `#F08C00` (Warning states)
- **Info Blue**: `#1864AB` (Information)

### Text Colors
- **Primary Text**: `#1F2937` (Main text)
- **Secondary Text**: `#6B7280` (Secondary text)
- **Muted Text**: `#9CA3AF` (Disabled/muted text)

### Borders & Dividers
- **Border Subtle**: `#E5E7EB` (Subtle borders)
- **Border Default**: `#D1D5DB` (Default borders)
- **Focus Ring**: `rgba(30, 102, 208, 0.35)` (Focus states)

## Typography

### Font Family
- **Primary Font**: Inter (Google Fonts)
- **Fallback**: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif

### Font Sizes
- **H1**: 2.25rem (36px)
- **H2**: 1.875rem (30px)
- **H3**: 1.5rem (24px)
- **H4**: 1.25rem (20px)
- **H5**: 1.125rem (18px)
- **H6**: 1rem (16px)
- **Body**: 1rem (16px)
- **Small**: 0.875rem (14px)
- **XSmall**: 0.75rem (12px)

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

## Border Radius

### Radius Scale
- **SM**: 4px
- **MD**: 6px
- **LG**: 8px
- **XL**: 12px
- **2XL**: 16px
- **Full**: 9999px (Circular)

## Shadows

### Shadow Scale
- **SM**: 0 1px 2px rgba(0, 0, 0, 0.05)
- **MD**: 0 4px 6px -1px rgba(0, 0, 0, 0.1)
- **LG**: 0 10px 15px -3px rgba(0, 0, 0, 0.1)
- **XL**: 0 20px 25px -5px rgba(0, 0, 0, 0.1)
- **2XL**: 0 25px 50px -12px rgba(0, 0, 0, 0.25)

## Transitions

### Transition Scale
- **Fast**: 150ms ease-in-out
- **Normal**: 250ms ease-in-out
- **Slow**: 350ms ease-in-out

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