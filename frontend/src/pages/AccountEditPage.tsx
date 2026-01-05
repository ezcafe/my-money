/**
 * Account Edit Page
 * Page for creating/editing account details
 */

import React from 'react';
import {useParams} from 'react-router';
import {EntityEditForm, type EntityEditFormConfig} from '../components/common/EntityEditForm';
import {CREATE_ACCOUNT, UPDATE_ACCOUNT} from '../graphql/mutations';
import {GET_ACCOUNT, GET_ACCOUNTS} from '../graphql/queries';

/**
 * Account data from GraphQL query
 */
interface AccountData {
  account?: {
    id: string;
    name: string;
    initBalance: number;
    isDefault: boolean;
    balance: number;
  } | null;
}

/**
 * Account Edit Page Component
 */
export function AccountEditPage(): React.JSX.Element {
  const {id} = useParams<{id: string}>();

  const config: EntityEditFormConfig<AccountData, {name: string; initBalance?: number}> = {
    entityType: 'Account',
    defaultReturnUrl: '/accounts',
    getQuery: GET_ACCOUNT,
    createMutation: CREATE_ACCOUNT,
    updateMutation: UPDATE_ACCOUNT,
    refetchQueries: (isEdit: boolean) => isEdit ? [GET_ACCOUNTS, 'GetAccount'] : [GET_ACCOUNTS],
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
        inputProps: {step: '0.01'},
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
    ],
    extractEntity: (data: AccountData): {id: string; [key: string]: unknown} | null => data?.account ?? null,
    transformToInput: (values: Record<string, unknown>) => {
      const nameValue = values.name;
      const nameStr = typeof nameValue === 'string' ? nameValue : typeof nameValue === 'number' ? String(nameValue) : '';

      // Handle optional initBalance - default to 0 if empty or invalid
      const initBalanceValue = values.initBalance;
      let initBalance: number | undefined = undefined;

      if (initBalanceValue !== undefined && initBalanceValue !== null && initBalanceValue !== '') {
        const parsed = typeof initBalanceValue === 'string' ? parseFloat(initBalanceValue) : Number(initBalanceValue);
        if (!isNaN(parsed)) {
          initBalance = parsed;
        }
      }

      // If initBalance is undefined, backend will default to 0
      return {
        name: nameStr,
        ...(initBalance !== undefined ? {initBalance} : {}),
      };
    },
  };

  return <EntityEditForm id={id} config={config} />;
}

