/**
 * Date Format Context
 * Provides date format preference throughout the application
 */

import React, {createContext, useContext, useMemo} from 'react';
import {useQuery} from '@apollo/client/react';
import {GET_PREFERENCES} from '../graphql/queries';

/**
 * Available date format options
 */
export type DateFormat = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD' | 'DD-MM-YYYY' | 'MM-DD-YYYY';

/**
 * Default date format
 */
export const DEFAULT_DATE_FORMAT: DateFormat = 'MM/DD/YYYY';

interface DateFormatContextType {
  dateFormat: DateFormat;
  loading: boolean;
}

const DateFormatContext = createContext<DateFormatContextType | undefined>(undefined);

/**
 * Date Format Provider Component
 */
export function DateFormatProvider({children}: {children: React.ReactNode}): React.JSX.Element {
  const {data, loading} = useQuery<{
    preferences?: {dateFormat: string | null};
  }>(GET_PREFERENCES, {
    fetchPolicy: 'cache-and-network',
  });

  const dateFormat = useMemo<DateFormat>(() => {
    const rawFormat = data?.preferences?.dateFormat;
    if (!rawFormat) {
      return DEFAULT_DATE_FORMAT;
    }

    // Decode HTML entities (e.g., &#x2F; -> /)
    const format = rawFormat.replace(/&#x2F;/g, '/').replace(/&#x2D;/g, '-');

    if (format === 'DD/MM/YYYY' || format === 'MM/DD/YYYY' || format === 'YYYY-MM-DD' || format === 'DD-MM-YYYY' || format === 'MM-DD-YYYY') {
      return format as DateFormat;
    }
    return DEFAULT_DATE_FORMAT;
  }, [data?.preferences?.dateFormat]);

  return (
    <DateFormatContext.Provider value={{dateFormat, loading}}>
      {children}
    </DateFormatContext.Provider>
  );
}

/**
 * Hook to use date format context
 */
export function useDateFormat(): DateFormatContextType {
  const context = useContext(DateFormatContext);
  if (context === undefined) {
    throw new Error('useDateFormat must be used within a DateFormatProvider');
  }
  return context;
}
