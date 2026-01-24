/**
 * Account Edit Page
 * Page for creating/editing account details
 */

import React from 'react';
import { useParams } from 'react-router';
import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { EntityEditForm, type EntityEditFormConfig } from '../components/common/EntityEditForm';
import { CREATE_ACCOUNT, UPDATE_ACCOUNT } from '../graphql/mutations';
import { GET_ACCOUNT, GET_ACCOUNTS } from '../graphql/queries';

type AccountType = 'Cash' | 'CreditCard' | 'Bank' | 'Saving' | 'Loans';

const ACCOUNT_TYPES: Array<{ value: AccountType; label: string }> = [
  { value: 'Cash', label: 'Cash' },
  { value: 'CreditCard', label: 'Credit Card' },
  { value: 'Bank', label: 'Bank' },
  { value: 'Saving', label: 'Saving' },
  { value: 'Loans', label: 'Loans' },
];

/**
 * Account data from GraphQL query
 */
interface AccountData {
  account?: {
    id: string;
    name: string;
    initBalance: number;
    isDefault: boolean;
    accountType: AccountType;
    balance: number;
  } | null;
}

/**
 * Account Edit Page Component
 */
export function AccountEditPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();

  const config: EntityEditFormConfig<
    AccountData,
    { name: string; initBalance?: number; accountType?: AccountType }
  > = {
    entityType: 'Account',
    defaultReturnUrl: '/accounts',
    getQuery: GET_ACCOUNT,
    createMutation: CREATE_ACCOUNT,
    updateMutation: UPDATE_ACCOUNT,
    refetchQueries: (isEdit: boolean, entityId?: string) => {
      if (isEdit && entityId) {
        return [{ query: GET_ACCOUNTS }, { query: GET_ACCOUNT, variables: { id: entityId } }];
      }
      return [{ query: GET_ACCOUNTS }];
    },
    fields: [
      {
        key: 'name',
        label: 'Name',
        type: 'text',
        required: true,
        defaultValue: '',
      },
      {
        key: 'initBalance',
        label: 'Initial Balance',
        type: 'number',
        required: false,
        defaultValue: 0,
        inputProps: { step: '0.01' },
        validate: (value: unknown): string | null => {
          // Allow empty values (optional field)
          if (!value || (typeof value === 'string' && value.trim() === '')) {
            return null;
          }
          const numValue = typeof value === 'string' ? parseFloat(value) : Number(value);
          if (isNaN(numValue)) {
            return 'Initial balance must be a valid number';
          }
          return null;
        },
      },
      {
        key: 'accountType',
        label: 'Account Type',
        type: 'custom',
        required: false,
        defaultValue: 'Cash',
        render: (value: unknown, onChange: (value: unknown) => void) => (
          <FormControl fullWidth>
            <InputLabel>Account Type</InputLabel>
            <Select
              value={value ?? 'Cash'}
              label="Account Type"
              onChange={(e) => onChange(e.target.value)}
            >
              {ACCOUNT_TYPES.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ),
      },
    ],
    extractEntity: (data: AccountData): { id: string; [key: string]: unknown } | null =>
      data?.account ?? null,
    transformToInput: (values: Record<string, unknown>) => {
      const nameValue = values.name;
      const nameStr =
        typeof nameValue === 'string'
          ? nameValue
          : typeof nameValue === 'number'
            ? String(nameValue)
            : '';

      // Handle optional initBalance - default to 0 if empty or invalid
      const initBalanceValue = values.initBalance;
      let initBalance: number | undefined = undefined;

      if (initBalanceValue !== undefined && initBalanceValue !== null && initBalanceValue !== '') {
        const parsed =
          typeof initBalanceValue === 'string'
            ? parseFloat(initBalanceValue)
            : Number(initBalanceValue);
        if (!isNaN(parsed)) {
          initBalance = parsed;
        }
      }

      // Handle accountType
      const accountTypeValue = values.accountType;
      const accountType =
        accountTypeValue && typeof accountTypeValue === 'string'
          ? (accountTypeValue as AccountType)
          : undefined;

      // If initBalance is undefined, backend will default to 0
      // If accountType is undefined, backend will default to Cash
      return {
        name: nameStr,
        ...(initBalance !== undefined ? { initBalance } : {}),
        ...(accountType !== undefined ? { accountType } : {}),
      };
    },
  };

  return <EntityEditForm id={id} config={config} />;
}
