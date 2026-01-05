/**
 * Payee Edit Page
 * Page for creating/editing payee details
 */

import React from 'react';
import {useParams} from 'react-router';
import {EntityEditForm, type EntityEditFormConfig} from '../components/common/EntityEditForm';
import {CREATE_PAYEE, UPDATE_PAYEE} from '../graphql/mutations';
import {GET_PAYEE} from '../graphql/queries';

/**
 * Payee data from GraphQL query
 */
interface PayeeData {
  payee?: {
    id: string;
    name: string;
    isDefault: boolean;
  } | null;
}

/**
 * Payee Edit Page Component
 */
export function PayeeEditPage(): React.JSX.Element {
  const {id} = useParams<{id: string}>();

  const config: EntityEditFormConfig<PayeeData, {name: string}> = {
    entityType: 'Payee',
    defaultReturnUrl: '/payees',
    getQuery: GET_PAYEE,
    createMutation: CREATE_PAYEE,
    updateMutation: UPDATE_PAYEE,
    refetchQueries: ['GetPayees', 'GetPayee'],
    fields: [
      {
        key: 'name',
        label: 'Name',
        type: 'text',
        required: true,
        defaultValue: '',
      },
    ],
    extractEntity: (data: PayeeData) => data?.payee ?? null,
    transformToInput: (values: Record<string, unknown>) => {
      const nameValue = values.name;
      const nameStr = typeof nameValue === 'string' ? nameValue : typeof nameValue === 'number' ? String(nameValue) : '';
      return {
        name: nameStr,
      };
    },
  };

  return <EntityEditForm id={id} config={config} />;
}

