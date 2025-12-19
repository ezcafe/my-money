/**
 * Preferences Page
 * Allows user to change currency, toggle 000/decimal, manage categories, payees, schedule, and logout
 */

import React from 'react';
import {Box, Typography, Switch, FormControlLabel, List} from '@mui/material';
import {Card} from '../components/ui/Card';
import {Button} from '../components/ui/Button';
import {TextField} from '../components/ui/TextField';

/**
 * Preferences Page Component
 */
export function PreferencesPage(): JSX.Element {
  const [useThousandSeparator, setUseThousandSeparator] = React.useState(true);
  const [currency, setCurrency] = React.useState('USD');

  return (
    <Box sx={{p: 2, maxWidth: 800, mx: 'auto'}}>
      <Typography variant="h4" gutterBottom>
        Preferences
      </Typography>

      <Card sx={{p: 2, mb: 2}}>
        <Typography variant="h6" gutterBottom>
          Display Settings
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={useThousandSeparator}
              onChange={(e) => setUseThousandSeparator(e.target.checked)}
            />
          }
          label="Use 000 separator (instead of decimal)"
        />
        <Box sx={{mt: 2}}>
          <TextField
            label="Currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            fullWidth
          />
        </Box>
      </Card>

      <Card sx={{p: 2, mb: 2}}>
        <Typography variant="h6" gutterBottom>
          Categories
        </Typography>
        <Button variant="outlined" sx={{mb: 2}}>
          Add Category
        </Button>
        <List>
          {/* Categories list will be populated from GraphQL */}
        </List>
      </Card>

      <Card sx={{p: 2, mb: 2}}>
        <Typography variant="h6" gutterBottom>
          Payees
        </Typography>
        <Button variant="outlined" sx={{mb: 2}}>
          Add Payee
        </Button>
        <List>
          {/* Payees list will be populated from GraphQL */}
        </List>
      </Card>

      <Card sx={{p: 2, mb: 2}}>
        <Typography variant="h6" gutterBottom>
          Schedule
        </Typography>
        <Button variant="outlined" onClick={() => window.location.href = '/schedule'}>
          Manage Recurring Transactions
        </Button>
      </Card>

      <Card sx={{p: 2}}>
        <Button
          variant="contained"
          color="error"
          fullWidth
          onClick={() => {
            localStorage.removeItem('oidc_token');
            window.location.href = '/';
          }}
        >
          Logout
        </Button>
      </Card>
    </Box>
  );
}


