/**
 * Home Page
 * Main page that displays the calculator and transaction history
 * Follows Material Design 3 nested container pattern
 */

import React from 'react';
import {Calculator} from '../components/Calculator';
import {PageContainer} from '../components/common/PageContainer';

/**
 * Home Page Component
 */
export function HomePage(): React.JSX.Element {
  return (
    <PageContainer>
      <Calculator />
    </PageContainer>
  );
}

