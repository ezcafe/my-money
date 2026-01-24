/**
 * Workspace Loader Page
 * Handles setting the active workspace from the URL and redirecting
 */

import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

/**
 * Workspace Loader Page Component
 */
export function WorkspaceLoaderPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setActiveWorkspaceId } = useWorkspace();

  useEffect(() => {
    if (id) {
      setActiveWorkspaceId(id);
      // Redirect to home page (dashboard) after setting the workspace
      void navigate('/', { replace: true });
    } else {
      // If no ID provided, just go home
      void navigate('/', { replace: true });
    }
  }, [id, setActiveWorkspaceId, navigate]);

  return <LoadingSpinner message="Switching workspace..." />;
}
