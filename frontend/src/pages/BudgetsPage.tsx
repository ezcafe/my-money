/**
 * Budgets Page
 * Lists and manages all budgets
 */

import React, {useState} from 'react';
import {useNavigate} from 'react-router';
import {Box, Typography, List, ListItem, ListItemButton, ListItemText, Divider, Autocomplete, Button, LinearProgress, Chip, ToggleButtonGroup, ToggleButton, Stack} from '@mui/material';
import {useQuery, useMutation} from '@apollo/client/react';
import {Dialog} from '../components/ui/Dialog';
import {GET_BUDGETS, GET_ACCOUNTS, GET_CATEGORIES, GET_PAYEES} from '../graphql/queries';
import {CREATE_BUDGET, UPDATE_BUDGET, DELETE_BUDGET} from '../graphql/mutations';
import {AttachMoney} from '@mui/icons-material';
import {LoadingSpinner} from '../components/common/LoadingSpinner';
import {ErrorAlert} from '../components/common/ErrorAlert';
import {EmptyState} from '../components/common/EmptyState';
import {Card} from '../components/ui/Card';
import {TextField} from '../components/ui/TextField';
import {PageContainer} from '../components/common/PageContainer';

/**
 * Budgets Page Component
 */
export function BudgetsPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<{
    id: string;
    amount: number;
    accountId?: string | null;
    categoryId?: string | null;
    payeeId?: string | null;
  } | null>(null);
  const [budgetType, setBudgetType] = useState<'account' | 'category' | 'payee'>('account');
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');

  const {data: budgetsData, loading: budgetsLoading, error: budgetsError} = useQuery<{
    budgets: Array<{
      id: string;
      amount: string;
      currentSpent: string;
      accountId: string | null;
      categoryId: string | null;
      payeeId: string | null;
      account: {id: string; name: string} | null;
      category: {id: string; name: string; type: string} | null;
      payee: {id: string; name: string} | null;
      percentageUsed: number;
    }>;
  }>(GET_BUDGETS, {
    fetchPolicy: 'cache-and-network',
  });

  const {data: accountsData} = useQuery<{accounts: Array<{id: string; name: string}>}>(GET_ACCOUNTS);
  const {data: categoriesData} = useQuery<{categories: Array<{id: string; name: string; type: string}>}>(GET_CATEGORIES);
  const {data: payeesData} = useQuery<{payees: Array<{id: string; name: string}>}>(GET_PAYEES);

  const [createBudget] = useMutation(CREATE_BUDGET, {
    refetchQueries: ['GetBudgets'],
  });
  const [updateBudget] = useMutation(UPDATE_BUDGET, {
    refetchQueries: ['GetBudgets'],
  });
  const [deleteBudget] = useMutation(DELETE_BUDGET, {
    refetchQueries: ['GetBudgets'],
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [budgetToDelete, setBudgetToDelete] = useState<string | null>(null);

  const accounts = accountsData?.accounts ?? [];
  const categories = (categoriesData?.categories ?? []).filter((c) => c.type === 'EXPENSE');
  const payees = payeesData?.payees ?? [];


  const confirmDeleteBudget = async (): Promise<void> => {
    if (budgetToDelete) {
      try {
        await deleteBudget({variables: {id: budgetToDelete}});
        setDeleteDialogOpen(false);
        setBudgetToDelete(null);
      } catch {
        // Error handled by mutation
      }
    }
  };

  const handleSaveBudget = async (): Promise<void> => {
    if (!selectedEntityId || !amount) {
      return;
    }

    try {
      if (editingBudget) {
        await updateBudget({
          variables: {
            id: editingBudget.id,
            input: {
              amount: parseFloat(amount),
            },
          },
        });
      } else {
        const input: {
          amount: number;
          accountId?: string | null;
          categoryId?: string | null;
          payeeId?: string | null;
        } = {
          amount: parseFloat(amount),
        };

        if (budgetType === 'account') {
          input.accountId = selectedEntityId;
        } else if (budgetType === 'category') {
          input.categoryId = selectedEntityId;
        } else if (budgetType === 'payee') {
          input.payeeId = selectedEntityId;
        }

        await createBudget({variables: {input}});
      }
      setBudgetDialogOpen(false);
      setEditingBudget(null);
      setSelectedEntityId('');
      setAmount('');
    } catch (error) {
      console.error('Failed to save budget:', error);
    }
  };

  const getBudgetName = (budget: {
    account: {name: string} | null;
    category: {name: string} | null;
    payee: {name: string} | null;
  }): string => {
    if (budget.account) return budget.account.name;
    if (budget.category) return budget.category.name;
    if (budget.payee) return budget.payee.name;
    return 'Unknown';
  };

  const getBudgetTypeLabel = (budget: {
    accountId: string | null;
    categoryId: string | null;
    payeeId: string | null;
  }): string => {
    if (budget.accountId) return 'Account';
    if (budget.categoryId) return 'Category';
    if (budget.payeeId) return 'Payee';
    return 'Unknown';
  };

  const getProgressColor = (percentage: number): 'success' | 'warning' | 'error' => {
    if (percentage < 50) return 'success';
    if (percentage < 80) return 'warning';
    return 'error';
  };

  if (budgetsLoading) {
    return <LoadingSpinner message="Loading budgets..." />;
  }

  if (budgetsError) {
    return (
      <ErrorAlert
        title="Error Loading Budgets"
        message={budgetsError.message}
      />
    );
  }

  const budgets = budgetsData?.budgets ?? [];

  if (budgets.length === 0) {
    return (
      <EmptyState
        icon={<AttachMoney />}
        title="No Budgets Yet"
        description="Click the + button to create a budget and track your spending limits."
      />
    );
  }

  return (
    <PageContainer>
      <Card>
        <List disablePadding>
          {budgets.map((budget, index) => {
            if (!budget?.id || budget.percentageUsed === undefined || budget.currentSpent == null || budget.amount == null) {
              return null;
            }
            // TypeScript now knows budget is fully defined
            const safeBudget = budget as {
              id: string;
              amount: string;
              currentSpent: string;
              accountId: string | null;
              categoryId: string | null;
              payeeId: string | null;
              account: {id: string; name: string} | null;
              category: {id: string; name: string; type: string} | null;
              payee: {id: string; name: string} | null;
              percentageUsed: number;
            };
            const percentage = safeBudget.percentageUsed;
            const spent = parseFloat(safeBudget.currentSpent);
            const total = parseFloat(safeBudget.amount);
            return (
              <React.Fragment key={safeBudget.id}>
                {index > 0 && <Divider />}
                <ListItem disablePadding>
                  <ListItemButton
                    onClick={() => {
                      void navigate(`/budgets/${safeBudget.id}`);
                    }}
                    sx={{
                      py: 1.5,
                      px: 2,
                    }}
                  >
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center" sx={{mb: 1}}>
                          <AttachMoney fontSize="small" color="primary" />
                          <Typography variant="body1" fontWeight={500}>
                            {getBudgetName(safeBudget)}
                          </Typography>
                          <Chip label={getBudgetTypeLabel(safeBudget)} size="small" variant="outlined" />
                        </Stack>
                      }
                      secondary={
                        <Box>
                          <Stack direction="row" justifyContent="space-between" sx={{mb: 0.5}}>
                            <Typography variant="caption" color="text.secondary">
                              {spent.toFixed(2)} / {total.toFixed(2)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" fontWeight={500}>
                              {percentage.toFixed(1)}%
                            </Typography>
                          </Stack>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(percentage, 100)}
                            color={getProgressColor(percentage)}
                            sx={{height: 8, borderRadius: 1}}
                          />
                        </Box>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              </React.Fragment>
            );
          })}
        </List>

        <Dialog
          open={budgetDialogOpen}
          onClose={() => {
            setBudgetDialogOpen(false);
            setEditingBudget(null);
            setSelectedEntityId('');
            setAmount('');
          }}
          title={editingBudget ? 'Edit Budget' : 'Create Budget'}
          actions={
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                onClick={() => {
                  setBudgetDialogOpen(false);
                  setEditingBudget(null);
                  setSelectedEntityId('');
                  setAmount('');
                }}
                variant="outlined"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  void handleSaveBudget();
                }}
                variant="contained"
                disabled={!selectedEntityId || !amount || parseFloat(amount) <= 0}
              >
                {editingBudget ? 'Update' : 'Create'}
              </Button>
            </Stack>
          }
        >
          <Stack spacing={2} sx={{minWidth: 400}}>
            {!editingBudget && (
              <>
                <Typography variant="body2" color="text.secondary">
                  Select the type of budget you want to create
                </Typography>
                <ToggleButtonGroup
                  value={budgetType}
                  exclusive
                  onChange={(_, value: 'account' | 'category' | 'payee' | null) => {
                    if (value) {
                      setBudgetType(value);
                      setSelectedEntityId('');
                    }
                  }}
                  fullWidth
                >
                  <ToggleButton value="account">Account</ToggleButton>
                  <ToggleButton value="category">Category</ToggleButton>
                  <ToggleButton value="payee">Payee</ToggleButton>
                </ToggleButtonGroup>
              </>
            )}

            {budgetType === 'account' && (
              <Autocomplete<{id: string; name: string}, false, false, false>
                options={accounts}
                getOptionLabel={(option) => option.name}
                value={accounts.find((a) => a.id === selectedEntityId) ?? null}
                onChange={(_, value) => {
                  setSelectedEntityId(value?.id ?? '');
                }}
                disabled={!!editingBudget}
                renderInput={(params) => (
                  <TextField {...params} label="Account" required />
                )}
              />
            )}

            {budgetType === 'category' && (
              <Autocomplete<{id: string; name: string; type: string}, false, false, false>
                options={categories}
                getOptionLabel={(option) => option.name}
                value={categories.find((c) => c.id === selectedEntityId) ?? null}
                onChange={(_, value) => {
                  setSelectedEntityId(value?.id ?? '');
                }}
                disabled={!!editingBudget}
                renderInput={(params) => (
                  <TextField {...params} label="Category" required />
                )}
              />
            )}

            {budgetType === 'payee' && (
              <Autocomplete<{id: string; name: string}, false, false, false>
                options={payees}
                getOptionLabel={(option) => option.name}
                value={payees.find((p) => p.id === selectedEntityId) ?? null}
                onChange={(_, value) => {
                  setSelectedEntityId(value?.id ?? '');
                }}
                disabled={!!editingBudget}
                renderInput={(params) => (
                  <TextField {...params} label="Payee" required />
                )}
              />
            )}

            <TextField
              label="Budget Amount"
              type="number"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
              }}
              inputProps={{min: 0, step: 0.01}}
              required
              fullWidth
            />
          </Stack>
        </Dialog>

        <Dialog
          open={deleteDialogOpen}
          onClose={() => {
            setDeleteDialogOpen(false);
            setBudgetToDelete(null);
          }}
          title="Delete Budget"
          actions={
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setBudgetToDelete(null);
                }}
                variant="outlined"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  void confirmDeleteBudget();
                }}
                variant="contained"
                color="error"
              >
                Delete
              </Button>
            </Stack>
          }
        >
          <Typography variant="body1">
            Are you sure you want to delete this budget? This action cannot be undone.
          </Typography>
        </Dialog>
      </Card>
    </PageContainer>
  );
}

