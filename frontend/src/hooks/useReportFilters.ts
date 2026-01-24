/**
 * Report Filters Hook
 * Manages filter state, date presets, and filter operations for report page
 */

import { useState, useCallback, useMemo } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { formatDateShort } from '../utils/formatting';
import type { DateFormat } from '../contexts/DateFormatContext';

/**
 * Preset date range type
 */
export type DatePreset =
  | 'today'
  | 'thisWeek'
  | 'thisMonth'
  | 'thisYear'
  | 'lastMonth'
  | 'last30Days'
  | 'last90Days'
  | 'custom';

/**
 * Date preset configuration
 */
interface DatePresetConfig {
  label: string;
  getDates: () => { startDate: string; endDate: string };
}

/**
 * Filter state interface
 */
export interface ReportFilters {
  accountIds: string[];
  categoryIds: string[];
  payeeIds: string[];
  startDate: string;
  endDate: string;
  note: string;
  memberIds: string[];
}

/**
 * Active filter chip interface
 */
export interface ActiveFilterChip {
  label: string;
  onDelete: () => void;
}

/**
 * Report filters hook return type
 */
export interface UseReportFiltersReturn {
  filters: ReportFilters;
  appliedFilters: ReportFilters;
  datePreset: DatePreset | null;
  showDatePickers: boolean;
  filterPanelExpanded: boolean;
  datePickerAnchor: HTMLElement | null;
  datePickerType: 'start' | 'end' | null;
  startDateText: string;
  endDateText: string;
  activeFilters: ActiveFilterChip[];
  hasFilters: boolean;
  handleFilterChange: (key: keyof ReportFilters, value: unknown) => void;
  handlePresetDateRange: (preset: DatePreset) => void;
  handleStartDateChange: (newValue: Dayjs | null) => void;
  handleEndDateChange: (newValue: Dayjs | null) => void;
  handleDatePickerOpen: (event: React.MouseEvent<HTMLElement>, type: 'start' | 'end') => void;
  handleDatePickerClose: () => void;
  handleApplyFilters: () => void;
  handleClearFilters: () => void;
  setFilterPanelExpanded: (expanded: boolean) => void;
  setAppliedFilters: React.Dispatch<React.SetStateAction<ReportFilters>>;
}

/**
 * Get date presets configuration
 */
export function getDatePresets(): Record<DatePreset, DatePresetConfig> {
  const today = dayjs();
  return {
    today: {
      label: 'Today',
      getDates: () => ({
        startDate: today.format('YYYY-MM-DD'),
        endDate: today.format('YYYY-MM-DD'),
      }),
    },
    thisWeek: {
      label: 'This Week',
      getDates: () => ({
        startDate: today.startOf('week').format('YYYY-MM-DD'),
        endDate: today.endOf('week').format('YYYY-MM-DD'),
      }),
    },
    thisMonth: {
      label: 'This Month',
      getDates: () => ({
        startDate: today.startOf('month').format('YYYY-MM-DD'),
        endDate: today.endOf('month').format('YYYY-MM-DD'),
      }),
    },
    thisYear: {
      label: 'This Year',
      getDates: () => ({
        startDate: today.startOf('year').format('YYYY-MM-DD'),
        endDate: today.endOf('year').format('YYYY-MM-DD'),
      }),
    },
    lastMonth: {
      label: 'Last Month',
      getDates: () => ({
        startDate: today.subtract(1, 'month').startOf('month').format('YYYY-MM-DD'),
        endDate: today.subtract(1, 'month').endOf('month').format('YYYY-MM-DD'),
      }),
    },
    last30Days: {
      label: 'Last 30 Days',
      getDates: () => ({
        startDate: today.subtract(30, 'day').format('YYYY-MM-DD'),
        endDate: today.format('YYYY-MM-DD'),
      }),
    },
    last90Days: {
      label: 'Last 90 Days',
      getDates: () => ({
        startDate: today.subtract(90, 'day').format('YYYY-MM-DD'),
        endDate: today.format('YYYY-MM-DD'),
      }),
    },
    custom: {
      label: 'Custom',
      getDates: () => ({
        startDate: '',
        endDate: '',
      }),
    },
  };
}

/**
 * Hook for managing report filters
 * @param dateFormat - Date format for display
 * @param accounts - Accounts array for active filter chips
 * @param categories - Categories array for active filter chips
 * @param payees - Payees array for active filter chips
 * @param members - Members array for active filter chips
 * @returns Filter state and handlers
 */
export function useReportFilters(
  dateFormat: DateFormat,
  accounts: Array<{ id: string; name: string }>,
  categories: Array<{ id: string; name: string }>,
  payees: Array<{ id: string; name: string }>,
  members: Array<{ id: string; userId: string; user: { id: string; email: string } }>
): UseReportFiltersReturn {
  // Filter state (current input values)
  const [filters, setFilters] = useState<ReportFilters>({
    accountIds: [],
    categoryIds: [],
    payeeIds: [],
    startDate: '',
    endDate: '',
    note: '',
    memberIds: [],
  });

  // Applied filters state (used for querying)
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>({
    accountIds: [],
    categoryIds: [],
    payeeIds: [],
    startDate: '',
    endDate: '',
    note: '',
    memberIds: [],
  });

  // Date preset state
  const [datePreset, setDatePreset] = useState<DatePreset | null>(null);

  // Date picker visibility state
  const [showDatePickers, setShowDatePickers] = useState<boolean>(false);

  // Filter panel collapse state
  const [filterPanelExpanded, setFilterPanelExpanded] = useState<boolean>(true);

  // Date picker popover state
  const [datePickerAnchor, setDatePickerAnchor] = useState<HTMLElement | null>(null);
  const [datePickerType, setDatePickerType] = useState<'start' | 'end' | null>(null);

  /**
   * Handle filter change
   */
  const handleFilterChange = useCallback((key: keyof ReportFilters, value: unknown): void => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  /**
   * Handle date picker button click
   */
  const handleDatePickerOpen = useCallback(
    (event: React.MouseEvent<HTMLElement>, type: 'start' | 'end') => {
      setDatePickerAnchor(event.currentTarget);
      setDatePickerType(type);
    },
    []
  );

  /**
   * Handle date picker close
   */
  const handleDatePickerClose = useCallback(() => {
    setDatePickerAnchor(null);
    setDatePickerType(null);
  }, []);

  /**
   * Handle start date change from calendar
   */
  const handleStartDateChange = useCallback(
    (newValue: Dayjs | null) => {
      if (newValue) {
        handleFilterChange('startDate', newValue.format('YYYY-MM-DD'));
      } else {
        handleFilterChange('startDate', '');
      }
      setDatePreset('custom');
      setShowDatePickers(true);
      handleDatePickerClose();
    },
    [handleFilterChange, handleDatePickerClose]
  );

  /**
   * Handle end date change from calendar
   */
  const handleEndDateChange = useCallback(
    (newValue: Dayjs | null) => {
      if (newValue) {
        handleFilterChange('endDate', newValue.format('YYYY-MM-DD'));
      } else {
        handleFilterChange('endDate', '');
      }
      setDatePreset('custom');
      setShowDatePickers(true);
      handleDatePickerClose();
    },
    [handleFilterChange, handleDatePickerClose]
  );

  /**
   * Get formatted start date text for button
   */
  const startDateText = useMemo(() => {
    if (filters.startDate) {
      return formatDateShort(filters.startDate, dateFormat);
    }
    return 'Start Date';
  }, [filters.startDate, dateFormat]);

  /**
   * Get formatted end date text for button
   */
  const endDateText = useMemo(() => {
    if (filters.endDate) {
      return formatDateShort(filters.endDate, dateFormat);
    }
    return 'End Date';
  }, [filters.endDate, dateFormat]);

  /**
   * Apply preset date range
   */
  const handlePresetDateRange = useCallback((preset: DatePreset) => {
    if (preset === 'custom') {
      setShowDatePickers(true);
      setDatePreset('custom');
    } else {
      const presets = getDatePresets();
      const presetConfig = presets[preset];
      if (presetConfig) {
        const dates = presetConfig.getDates();
        setFilters((prev) => ({
          ...prev,
          startDate: dates.startDate,
          endDate: dates.endDate,
        }));
        setDatePreset(preset);
        setShowDatePickers(false);
      }
    }
  }, []);

  /**
   * Apply filters - copy current filter inputs to applied filters
   */
  const handleApplyFilters = useCallback((): void => {
    setAppliedFilters({ ...filters });
    // Only collapse if there are filter criteria applied
    const hasFilterCriteria =
      filters.accountIds.length > 0 ||
      filters.categoryIds.length > 0 ||
      filters.payeeIds.length > 0 ||
      filters.startDate !== '' ||
      filters.endDate !== '' ||
      filters.note.trim() !== '' ||
      filters.memberIds.length > 0;
    if (hasFilterCriteria) {
      setFilterPanelExpanded(false);
    }
  }, [filters]);

  /**
   * Clear all filters
   */
  const handleClearFilters = useCallback((): void => {
    const emptyFilters: ReportFilters = {
      accountIds: [],
      categoryIds: [],
      payeeIds: [],
      startDate: '',
      endDate: '',
      note: '',
      memberIds: [],
    };
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setDatePreset(null);
    setShowDatePickers(false);
    setFilterPanelExpanded(true);
  }, []);

  /**
   * Check if filters are applied
   */
  const hasFilters = useMemo(() => {
    return (
      appliedFilters.accountIds.length > 0 ||
      appliedFilters.categoryIds.length > 0 ||
      appliedFilters.payeeIds.length > 0 ||
      appliedFilters.startDate !== '' ||
      appliedFilters.endDate !== '' ||
      appliedFilters.note.trim() !== '' ||
      appliedFilters.memberIds.length > 0
    );
  }, [appliedFilters]);

  /**
   * Get active filter chips
   */
  const activeFilters = useMemo(() => {
    const chips: ActiveFilterChip[] = [];

    if (appliedFilters.startDate && appliedFilters.endDate) {
      chips.push({
        label: `${formatDateShort(appliedFilters.startDate, dateFormat)} - ${formatDateShort(appliedFilters.endDate, dateFormat)}`,
        onDelete: () => {
          setFilters((prev) => ({ ...prev, startDate: '', endDate: '' }));
          setAppliedFilters((prev) => ({ ...prev, startDate: '', endDate: '' }));
          setDatePreset(null);
          setShowDatePickers(false);
        },
      });
    }

    appliedFilters.accountIds.forEach((id) => {
      const account = accounts.find((a) => a.id === id);
      if (account) {
        chips.push({
          label: `Account: ${account.name}`,
          onDelete: () => {
            const newIds = appliedFilters.accountIds.filter((aid) => aid !== id);
            setFilters((prev) => ({ ...prev, accountIds: newIds }));
            setAppliedFilters((prev) => ({ ...prev, accountIds: newIds }));
          },
        });
      }
    });

    appliedFilters.categoryIds.forEach((id) => {
      const category = categories.find((c) => c.id === id);
      if (category) {
        chips.push({
          label: `Category: ${category.name}`,
          onDelete: () => {
            const newIds = appliedFilters.categoryIds.filter((cid) => cid !== id);
            setFilters((prev) => ({ ...prev, categoryIds: newIds }));
            setAppliedFilters((prev) => ({ ...prev, categoryIds: newIds }));
          },
        });
      }
    });

    appliedFilters.payeeIds.forEach((id) => {
      const payee = payees.find((p) => p.id === id);
      if (payee) {
        chips.push({
          label: `Payee: ${payee.name}`,
          onDelete: () => {
            const newIds = appliedFilters.payeeIds.filter((pid) => pid !== id);
            setFilters((prev) => ({ ...prev, payeeIds: newIds }));
            setAppliedFilters((prev) => ({ ...prev, payeeIds: newIds }));
          },
        });
      }
    });

    if (appliedFilters.note.trim()) {
      chips.push({
        label: `Note: ${appliedFilters.note.trim()}`,
        onDelete: () => {
          setFilters((prev) => ({ ...prev, note: '' }));
          setAppliedFilters((prev) => ({ ...prev, note: '' }));
        },
      });
    }

    appliedFilters.memberIds.forEach((memberId) => {
      const member = members.find((m) => m.userId === memberId);
      if (member) {
        chips.push({
          label: `Member: ${member.user.email}`,
          onDelete: () => {
            const newIds = appliedFilters.memberIds.filter((mid) => mid !== memberId);
            setFilters((prev) => ({ ...prev, memberIds: newIds }));
            setAppliedFilters((prev) => ({ ...prev, memberIds: newIds }));
          },
        });
      }
    });

    return chips;
  }, [appliedFilters, accounts, categories, payees, members, dateFormat]);

  return {
    filters,
    appliedFilters,
    datePreset,
    showDatePickers,
    filterPanelExpanded,
    datePickerAnchor,
    datePickerType,
    startDateText,
    endDateText,
    activeFilters,
    hasFilters,
    handleFilterChange,
    handlePresetDateRange,
    handleStartDateChange,
    handleEndDateChange,
    handleDatePickerOpen,
    handleDatePickerClose,
    handleApplyFilters,
    handleClearFilters,
    setFilterPanelExpanded,
    setAppliedFilters,
  };
}
