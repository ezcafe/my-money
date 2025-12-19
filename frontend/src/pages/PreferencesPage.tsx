/**
 * Preferences Page
 * Allows user to change currency, toggle 000/decimal, manage categories, payees, schedule, and logout
 */

import React, {useState} from 'react';
import {useNavigate} from 'react-router';
import {Box, Typography, Switch, FormControlLabel, List} from '@mui/material';
import {Card} from '../components/ui/Card';
import {Button} from '../components/ui/Button';
import {TextField} from '../components/ui/TextField';
import {logout} from '../utils/oidc';

/**
 * Preferences Page Component
 */
export function PreferencesPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [useThousandSeparator, setUseThousandSeparator] = useState(true);
  const [currency, setCurrency] = useState('USD');

  /**
   * Handle logout
   * Clears tokens and redirects to login page
   */
  const handleLogout = (): void => {
    logout();
    navigate('/login', {replace: true});
  };

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
          onClick={handleLogout}
        >
          Logout
        </Button>
      </Card>
    </Box>
  );
}


