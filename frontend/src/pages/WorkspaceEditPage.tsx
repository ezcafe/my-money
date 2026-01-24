/**
 * Workspace Edit Page
 * Page for creating/editing workspace details
 */

import React from 'react';
import { useParams } from 'react-router';
import { EntityEditForm, type EntityEditFormConfig } from '../components/common/EntityEditForm';
import { CREATE_WORKSPACE, UPDATE_WORKSPACE, GET_WORKSPACE } from '../graphql/workspaceOperations';

/**
 * Workspace data from GraphQL query
 */
interface WorkspaceData {
  workspace?: {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
  } | null;
}

/**
 * Workspace Edit Page Component
 */
export function WorkspaceEditPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();

  const config: EntityEditFormConfig<
    WorkspaceData,
    { name: string }
  > = {
    entityType: 'Workspace',
    defaultReturnUrl: '/workspaces',
    getQuery: GET_WORKSPACE,
    createMutation: CREATE_WORKSPACE,
    updateMutation: UPDATE_WORKSPACE,
    refetchQueries: ['GetWorkspaces'],
    fields: [
      {
        key: 'name',
        label: 'Workspace Name',
        type: 'text',
        required: true,
        defaultValue: '',
      },
    ],
    extractEntity: (data: WorkspaceData): { id: string; [key: string]: unknown } | null =>
      data?.workspace ?? null,
    transformToInput: (values: Record<string, unknown>): { name: string } => {
      const nameValue = values.name;
      const nameStr =
        typeof nameValue === 'string'
          ? nameValue
          : typeof nameValue === 'number'
            ? String(nameValue)
            : '';
      return {
        name: nameStr.trim(),
      };
    },
  };

  return <EntityEditForm id={id} config={config} />;
}
