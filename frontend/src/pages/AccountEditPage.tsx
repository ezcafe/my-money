/**
 * Account Edit Page
 * Page for creating/editing account details
 */

import React from 'react';
import {useParams} from 'react-router';
import {EntityEditForm, type EntityEditFormConfig} from '../components/common/EntityEditForm';
import {CREATE_ACCOUNT, UPDATE_ACCOUNT} from '../graphql/mutations';
import {GET_ACCOUNT} from '../graphql/queries';

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

  const config: EntityEditFormConfig<AccountData, {name: string; initBalance: number}> = {
    entityType: 'Account',
    defaultReturnUrl: '/accounts',
    getQuery: GET_ACCOUNT,
    createMutation: CREATE_ACCOUNT,
    updateMutation: UPDATE_ACCOUNT,
    refetchQueries: ['GetAccounts', 'GetAccount'],
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
        required: true,
        defaultValue: 0,
        inputProps: {step: '0.01'},
        validate: (value: unknown): string | null => {
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
      const initBalance = typeof values.initBalance === 'string' ? parseFloat(values.initBalance) : Number(values.initBalance);
      const nameValue = values.name;
      const nameStr = typeof nameValue === 'string' ? nameValue : typeof nameValue === 'number' ? String(nameValue) : '';
      return {
        name: nameStr,
        initBalance: isNaN(initBalance) ? 0 : initBalance,
      };
    },
  };

  return <EntityEditForm id={id} config={config} />;
}

