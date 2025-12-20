/**
 * Report Page
 * Allows filtering transactions by account, date, category, and payee
 */

import React, {useState} from 'react';
import {Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow} from '@mui/material';
import {Card} from '../components/ui/Card';
import {Button} from '../components/ui/Button';
import {TextField} from '../components/ui/TextField';
import {formatCurrency} from '../utils/formatting';
import {validateDateRange} from '../utils/validation';

/**
 * Report Page Component
 */
export function ReportPage(): React.JSX.Element {
  const [filters, setFilters] = useState({
    accountIds: [] as string[],
    categoryIds: [] as string[],
    payeeIds: [] as string[],
    startDate: '',
    endDate: '',
  });

  const [results, setResults] = useState<Array<{
    id: string;
    date: string;
    value: number;
    account: string;
    category: string;
    payee: string;
  }>>([]);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateReport = (): void => {
    setError(null);

    if (filters.startDate && filters.endDate) {
      if (!validateDateRange(filters.startDate, filters.endDate)) {
        setError('End date must be after start date');
        return;
      }
    }

    // TODO: Implement report query with GraphQL
    // For now, show empty results
    setResults([]);
  };

  return (
    <Box sx={{p: 2, width: '100%'}}>
      <Typography variant="h4" gutterBottom>
        Report
      </Typography>

      <Card sx={{p: 2, mb: 3}}>
        <Typography variant="h6" gutterBottom>
          Filters
        </Typography>
        {error && (
          <Box sx={{mb: 2, color: 'error.main'}}>
            <Typography variant="body2" color="error">
              {error}
            </Typography>
          </Box>
        )}
        <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
          <TextField
            label="Start Date"
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({...filters, startDate: e.target.value})}
            InputLabelProps={{shrink: true}}
          />
          <TextField
            label="End Date"
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({...filters, endDate: e.target.value})}
            InputLabelProps={{shrink: true}}
          />
          <Button variant="contained" onClick={handleGenerateReport}>
            Generate Report
          </Button>
        </Box>
      </Card>

      <Card sx={{p: 2}}>
        <Typography variant="h6" gutterBottom>
          Results
        </Typography>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Value</TableCell>
                <TableCell>Account</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Payee</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No results. Apply filters and generate report.
                  </TableCell>
                </TableRow>
              ) : (
                results.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.date}</TableCell>
                    <TableCell>{formatCurrency(item.value)}</TableCell>
                    <TableCell>{item.account}</TableCell>
                    <TableCell>{item.category}</TableCell>
                    <TableCell>{item.payee}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}


