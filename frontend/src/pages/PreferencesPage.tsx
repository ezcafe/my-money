/**
 * Preferences Page
 * Allows user to change currency, toggle 000/decimal, manage categories, payees, schedule, and logout
 */

import React, {useState, useEffect, useRef} from 'react';
import {useNavigate} from 'react-router';
import {Box, Typography, Switch, FormControlLabel, List} from '@mui/material';
import {useQuery, useMutation} from '@apollo/client/react';
import {Card} from '../components/ui/Card';
import {Button} from '../components/ui/Button';
import {TextField} from '../components/ui/TextField';
import {logout} from '../utils/oidc';
import {GET_PREFERENCES} from '../graphql/queries';
import {UPDATE_PREFERENCES} from '../graphql/mutations';

/**
 * Preferences Page Component
 */
export function PreferencesPage(): React.JSX.Element {
  const navigate = useNavigate();
  const {data: preferencesData, loading: preferencesLoading} = useQuery<{
    preferences?: {currency: string; useThousandSeparator: boolean};
  }>(GET_PREFERENCES);
  const [updatePreferences, {loading: updating}] = useMutation(UPDATE_PREFERENCES, {
    refetchQueries: ['GetPreferences'],
    awaitRefetchQueries: true,
  });

  const [useThousandSeparator, setUseThousandSeparator] = useState(true);
  const [currency, setCurrency] = useState('USD');
  const currencyUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize state from loaded preferences
  useEffect(() => {
    if (preferencesData?.preferences) {
      setUseThousandSeparator(preferencesData.preferences.useThousandSeparator);
      setCurrency(preferencesData.preferences.currency);
    }
  }, [preferencesData]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (currencyUpdateTimeoutRef.current) {
        clearTimeout(currencyUpdateTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Handle logout
   * Clears tokens and redirects to login page
   */
  const handleLogout = (): void => {
    logout();
    navigate('/login', {replace: true});
  };

  /**
   * Handle useThousandSeparator change
   * Saves preference to backend
   */
  const handleUseThousandSeparatorChange = (checked: boolean): void => {
    setUseThousandSeparator(checked);
    void updatePreferences({
      variables: {
        input: {
          useThousandSeparator: checked,
        },
      },
    });
  };

  /**
   * Handle currency change
   * Updates local state immediately and debounces the API call to prevent excessive requests
   */
  const handleCurrencyChange = (newCurrency: string): void => {
    setCurrency(newCurrency);

    // Clear existing timeout if user is still typing
    if (currencyUpdateTimeoutRef.current) {
      clearTimeout(currencyUpdateTimeoutRef.current);
    }

    // Set new timeout to update preferences after user stops typing (500ms delay)
    currencyUpdateTimeoutRef.current = setTimeout(() => {
      void updatePreferences({
        variables: {
          input: {
            currency: newCurrency,
          },
        },
      });
      currencyUpdateTimeoutRef.current = null;
    }, 500);
  };

  return (
    <Box sx={{width: '100%'}}>
      <Card sx={{p: 2, mb: 2}}>
        <Typography variant="h6" gutterBottom>
          Display Settings
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={useThousandSeparator}
              onChange={(e) => handleUseThousandSeparatorChange(e.target.checked)}
              disabled={preferencesLoading || updating}
            />
          }
          label="Use 000 separator (instead of decimal)"
        />
        <Box sx={{mt: 2}}>
          <TextField
            label="Currency"
            value={currency}
            onChange={(e) => handleCurrencyChange(e.target.value)}
            fullWidth
            disabled={preferencesLoading || updating}
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


