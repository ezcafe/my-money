# Material Design 3 Style Guide

This document outlines the Material Design 3 (M3) design patterns and styles applied throughout the frontend application. Use this guide as a reference when creating new pages or components to ensure consistency.

## Table of Contents

1. [Design Principles](#design-principles)
2. [Spacing System](#spacing-system)
3. [Typography](#typography)
4. [Components](#components)
5. [Page Patterns](#page-patterns)
6. [Color & Elevation](#color--elevation)
7. [Empty States](#empty-states)
8. [Examples](#examples)

## Design Principles

### Core Principles

1. **4dp Grid System**: All spacing follows a 4dp (4px) grid system
2. **Consistent Elevation**: Use elevation to create visual hierarchy
3. **Surface Colors**: Use proper surface colors for cards and containers
4. **Typography Scale**: Follow consistent typography hierarchy
5. **Smooth Transitions**: All interactive elements have 0.2s ease transitions

## Spacing System

### Standard Spacing Values

All spacing uses multiples of 4px (4dp):

```typescript
// Common spacing values
p: 2; // 8px  - Small padding
p: 3; // 12px - Standard card padding
p: 4; // 16px - Large padding (empty states)

mb: 2; // 8px  - Small margin
mb: 3; // 12px - Standard margin between sections
mb: 4; // 16px - Large margin

gap: 1; // 4px  - Small gap
gap: 2; // 8px  - Standard gap
gap: 3; // 12px - Large gap
```

### Page Layout Spacing

```typescript
// Page container
<Box sx={{maxWidth: '800px', mx: 'auto'}}>  // Centered, max-width

// Section spacing
<Card sx={{mb: 3, p: 3}}>  // Standard card: 12px padding, 12px bottom margin
```

### List Item Spacing

```typescript
<ListItemButton sx={{py: 1.5, px: 2}}>  // 6px vertical, 8px horizontal
```

## Typography

### Typography Scale

```typescript
// Headings
variant = 'h3'; // Large display (balance amounts)
variant = 'h5'; // Card titles
variant = 'h6'; // Section titles, page titles

// Body text
variant = 'body1'; // Primary text (fontWeight: 500 for emphasis)
variant = 'body2'; // Secondary text, descriptions
variant = 'subtitle2'; // Labels, small headings
variant = 'caption'; // Helper text, metadata
```

### Font Weights

```typescript
fontWeight: 500; // Medium - for emphasized body text
fontWeight: 600; // Semi-bold - for headings and important numbers
```

### Typography Usage Patterns

```typescript
// Page title
<Typography variant="h6" component="h2" sx={{mb: 3}}>
  Page Title
</Typography>

// Section label
<Typography variant="subtitle2" color="text.secondary" sx={{mb: 1}}>
  Section Label
</Typography>

// Primary amount/balance
<Typography variant="h3" component="div" color="primary.main" fontWeight={600}>
  $1,234.56
</Typography>

// Card value
<Typography variant="h5" sx={{fontWeight: 600}}>
  $1,234.56
</Typography>

// Body text with emphasis
<Typography variant="body1" fontWeight={500}>
  Account Name
</Typography>

// Secondary text
<Typography variant="body2" color="text.secondary">
  Description text
</Typography>
```

## Components

### Card Component

**Standard Card Pattern:**

```typescript
import {Card} from '../components/ui/Card';

<Card sx={{mb: 3, p: 3}}>
  {/* Content */}
</Card>
```

**Card Spacing:**

- Padding: `p: 3` (12px) - standard
- Padding: `p: 4` (16px) - for empty states
- Margin bottom: `mb: 3` (12px) - between sections

**Card with Header:**

```typescript
<Card sx={{mb: 3}}>
  <Box sx={{p: 3, pb: 2}}>
    <Typography variant="h6" component="h2">
      Section Title
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{mt: 0.5}}>
      Section description
    </Typography>
  </Box>
  {/* Content with px: 3, pb: 3 */}
</Card>
```

### List Component

**Standard List Pattern:**

```typescript
<Card>
  <List disablePadding>
    {items.map((item, index) => (
      <React.Fragment key={item.id}>
        {index > 0 && <Divider />}
        <ListItemButton
          sx={{
            py: 1.5,
            px: 2,
            transition: 'background-color 0.2s ease',
            '&:hover': {
              backgroundColor: 'action.hover',
            },
          }}
        >
          <ListItemText
            primary={
              <Typography variant="body1" fontWeight={500}>
                {item.name}
              </Typography>
            }
          />
        </ListItemButton>
      </React.Fragment>
    ))}
  </List>
</Card>
```

**List Item Spacing:**

- Vertical padding: `py: 1.5` (6px)
- Horizontal padding: `px: 2` (8px)
- Dividers between items (except first)

### Button Component

**Standard Button Usage:**

```typescript
import {Button} from '../components/ui/Button';

// Primary action
<Button variant="contained" size="large" fullWidth>
  Save
</Button>

// Secondary action
<Button variant="outlined" onClick={handleCancel}>
  Cancel
</Button>

// Text button
<Button variant="text" size="small">
  Clear
</Button>
```

**Button Spacing:**

- Use `sx={{textTransform: 'none'}}` to prevent uppercase
- Full width buttons for mobile: `fullWidth={isMobile}`

### TextField Component

**Standard TextField Usage:**

```typescript
import {TextField} from '../components/ui/TextField';

<TextField
  label="Field Label"
  value={value}
  onChange={handleChange}
  fullWidth
  required
/>
```

## Page Patterns

### List Page Pattern

```typescript
export function ListPage(): React.JSX.Element {
  const {items, loading, error} = useItems();

  if (loading) {
    return <LoadingSpinner useSkeleton skeletonVariant="list" skeletonCount={5} />;
  }

  if (error) {
    return (
      <ErrorAlert
        title="Error Loading Items"
        message={error.message}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Icon />}
        title="No Items Yet"
        description="Description of what to do next."
      />
    );
  }

  return (
    <Box>
      <Card>
        <List disablePadding>
          {items.map((item, index) => (
            <React.Fragment key={item.id}>
              {index > 0 && <Divider />}
              <ListItemButton
                onClick={() => navigate(`/items/${item.id}`)}
                sx={{py: 1.5, px: 2}}
              >
                <ListItemText
                  primary={
                    <Typography variant="body1" fontWeight={500}>
                      {item.name}
                    </Typography>
                  }
                />
              </ListItemButton>
            </React.Fragment>
          ))}
        </List>
      </Card>
    </Box>
  );
}
```

### Detail Page Pattern

```typescript
export function DetailPage(): React.JSX.Element {
  const {id} = useParams<{id: string}>();
  const {item, loading, error} = useItem(id);

  if (loading) {
    return <LoadingSpinner message="Loading..." />;
  }

  if (error) {
    return <ErrorAlert title="Error" message={error.message} />;
  }

  if (!item) {
    return <ErrorAlert title="Not Found" message="Item not found." severity="warning" />;
  }

  return (
    <Box>
      {/* Summary Card */}
      <Card sx={{mb: 3, p: 3}}>
        <Typography variant="subtitle2" color="text.secondary" sx={{mb: 1}}>
          Label
        </Typography>
        <Typography variant="h3" component="div" color="primary.main" fontWeight={600}>
          {formatValue(item.value)}
        </Typography>
      </Card>

      {/* Content */}
      <ContentComponent />
    </Box>
  );
}
```

### Complex Page Pattern (Report, Import, Settings)

```typescript
export function ComplexPage(): React.JSX.Element {
  return (
    <Box sx={{maxWidth: '1400px', mx: 'auto'}}>
      {/* Section 1 */}
      <Card sx={{mb: 3}}>
        <Box sx={{p: 3, pb: 2}}>
          <Typography variant="h6" component="h2">
            Section Title
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{mt: 0.5}}>
            Section description
          </Typography>
        </Box>
        <Box sx={{px: 3, pb: 3}}>
          {/* Section content */}
        </Box>
      </Card>

      {/* Section 2 */}
      <Card sx={{mb: 3, p: 3}}>
        {/* Direct content */}
      </Card>
    </Box>
  );
}
```

## Color & Elevation

### Surface Colors

```typescript
// Standard surface
backgroundColor: 'background.paper'; // Card background
backgroundColor: 'background.default'; // Page background

// Interactive surfaces
backgroundColor: 'action.hover'; // Hover state
backgroundColor: 'surfaceVariant'; // Alternative surface
```

### Color Usage

```typescript
// Primary actions
color: 'primary.main';

// Success/Income
color: 'success.main';

// Error/Expenses
color: 'error.main';

// Warning
color: 'warning.main';

// Text colors
color: 'text.primary'; // Main text
color: 'text.secondary'; // Secondary text
color: 'text.disabled'; // Disabled text
```

### Elevation

Elevation is handled automatically by the Card component:

- Default: `elevation: 0` (flat)
- Hover: `elevation: 4` (raised)

## Empty States

### EmptyState Component

```typescript
import {EmptyState} from '../components/common/EmptyState';

<EmptyState
  icon={<Icon />}
  title="No Items Yet"
  description="Description of what to do next."
  action={
    <Button variant="contained" onClick={handleAction}>
      Create Item
    </Button>
  }
/>
```

### Empty State Pattern

- Always use the `EmptyState` component
- Include an icon (64px, opacity 0.5, text.secondary)
- Clear title (variant="h6")
- Helpful description (variant="body2", maxWidth: '500px', centered)
- Optional action button

### Empty State Examples

```typescript
// Simple empty state
<EmptyState
  icon={<AccountBalance />}
  title="No Accounts Yet"
  description="Get started by creating your first account to track your finances."
/>

// Empty state with action
<EmptyState
  icon={<Receipt />}
  title="No Transactions Found"
  description="No transactions match your current filters."
  action={
    <Button variant="outlined" onClick={handleClearFilters}>
      Clear Filters
    </Button>
  }
/>
```

## Examples

### Complete List Page Example

```typescript
/**
 * Accounts Page
 * Lists all accounts with total amounts
 * Follows Material Design 3 patterns
 */

import React, {memo} from 'react';
import {Box, Typography, List, ListItemButton, ListItemText, Divider} from '@mui/material';
import {useNavigate} from 'react-router';
import {AccountBalance} from '@mui/icons-material';
import {useAccounts} from '../hooks/useAccounts';
import {formatCurrencyPreserveDecimals} from '../utils/formatting';
import {LoadingSpinner} from '../components/common/LoadingSpinner';
import {ErrorAlert} from '../components/common/ErrorAlert';
import {EmptyState} from '../components/common/EmptyState';
import {Card} from '../components/ui/Card';

const AccountsPageComponent = (): React.JSX.Element => {
  const {accounts, loading, error} = useAccounts();
  const navigate = useNavigate();

  if (loading) {
    return <LoadingSpinner useSkeleton skeletonVariant="list" skeletonCount={5} />;
  }

  if (error) {
    return (
      <ErrorAlert
        title="Error Loading Accounts"
        message={error.message}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={<AccountBalance />}
        title="No Accounts Yet"
        description="Get started by creating your first account to track your finances."
      />
    );
  }

  return (
    <Box>
      <Card>
        <List disablePadding>
          {accounts.map((account, index) => (
            <React.Fragment key={account.id}>
              {index > 0 && <Divider />}
              <ListItemButton
                onClick={(): void => {
                  void navigate(`/accounts/${account.id}`);
                }}
                sx={{
                  py: 1.5,
                  px: 2,
                  transition: 'background-color 0.2s ease',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                }}
              >
                <ListItemText
                  primary={account.name}
                  primaryTypographyProps={{
                    variant: 'body1',
                    fontWeight: 500,
                  }}
                />
                <Typography variant="body1" fontWeight={500} color="text.primary">
                  {formatCurrencyPreserveDecimals(account.balance)}
                </Typography>
              </ListItemButton>
            </React.Fragment>
          ))}
        </List>
      </Card>
    </Box>
  );
};

AccountsPageComponent.displayName = 'AccountsPage';
export const AccountsPage = memo(AccountsPageComponent);
```

### Summary Card Example

```typescript
<Card sx={{mb: 3, p: 3}}>
  <Typography variant="subtitle2" color="text.secondary" sx={{mb: 1}}>
    Balance
  </Typography>
  <Typography variant="h3" component="div" color="primary.main" fontWeight={600}>
    {formatCurrencyPreserveDecimals(account.balance, currency)}
  </Typography>
</Card>
```

### Grid Summary Cards Example

```typescript
<Grid container spacing={2} sx={{mb: 3}}>
  <Grid item xs={12} sm={6} md={3}>
    <Card sx={{p: 3, height: '100%'}}>
      <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1}}>
        <Icon sx={{color: 'primary.main'}} />
        <Typography variant="subtitle2" color="text.secondary">
          Label
        </Typography>
      </Box>
      <Typography variant="h5" sx={{fontWeight: 600}}>
        {value}
      </Typography>
    </Card>
  </Grid>
</Grid>
```

## Checklist for New Pages

When creating a new page, ensure:

- [ ] Uses 4dp grid spacing (multiples of 4px)
- [ ] Cards use `p: 3` for standard padding
- [ ] Sections have `mb: 3` spacing between them
- [ ] List items use `py: 1.5, px: 2` padding
- [ ] Typography follows the scale (h3 for large amounts, h5 for card values, body1 for text)
- [ ] Font weights: 500 for medium, 600 for bold
- [ ] Empty states use `EmptyState` component
- [ ] Error states use `ErrorAlert` component
- [ ] Loading states use `LoadingSpinner` component
- [ ] All interactive elements have hover states
- [ ] Transitions are 0.2s ease
- [ ] Dividers between list items (except first)
- [ ] Consistent color usage (primary, success, error, text.secondary)
- [ ] Max-width containers for centered content
- [ ] Responsive design considerations

## Notes

- Always import custom components from `../components/ui/` or `../components/common/`
- Use MUI components directly only when custom wrappers don't exist
- Follow the established patterns for consistency
- When in doubt, reference existing pages that follow these patterns
