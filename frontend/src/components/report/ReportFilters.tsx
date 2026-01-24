/**
 * Report Filters Component
 * Handles filter UI including date presets, multi-select filters, and active filter chips
 */

import React, { memo } from 'react';
import { Box, Typography, IconButton, Popover, Collapse, Chip } from '@mui/material';
import Grid from '@mui/material/Grid2';
import { Clear, CalendarToday, ExpandMore, ExpandLess } from '@mui/icons-material';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { type Dayjs } from 'dayjs';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { TextField } from '../ui/TextField';
import { MultiSelect, type MultiSelectOption } from '../ui/MultiSelect';
import { WorkspaceSelector } from '../WorkspaceSelector';
import type {
  UseReportFiltersReturn,
  DatePreset,
  ActiveFilterChip,
} from '../../hooks/useReportFilters';
import { getDatePresets } from '../../hooks/useReportFilters';

/**
 * ReportFilters component props
 */
interface ReportFiltersProps {
  // Filter state and handlers from hook
  filters: UseReportFiltersReturn['filters'];
  datePreset: DatePreset | null;
  showDatePickers: boolean;
  filterPanelExpanded: boolean;
  datePickerAnchor: HTMLElement | null;
  datePickerType: 'start' | 'end' | null;
  startDateText: string;
  endDateText: string;
  activeFilters: ActiveFilterChip[];
  hasFilters: boolean;
  handleFilterChange: (key: keyof UseReportFiltersReturn['filters'], value: unknown) => void;
  handlePresetDateRange: (preset: DatePreset) => void;
  handleStartDateChange: (newValue: Dayjs | null) => void;
  handleEndDateChange: (newValue: Dayjs | null) => void;
  handleDatePickerOpen: (event: React.MouseEvent<HTMLElement>, type: 'start' | 'end') => void;
  handleDatePickerClose: () => void;
  handleApplyFilters: () => void;
  handleClearFilters: () => void;
  setFilterPanelExpanded: (expanded: boolean) => void;
  // Data for filters
  accountOptions: MultiSelectOption[];
  categoryOptions: MultiSelectOption[];
  payeeOptions: MultiSelectOption[];
  workspaces: Array<{ id: string; name: string }>;
  selectedWorkspaceId: string;
  members: Array<{ id: string; userId: string; user: { id: string; email: string } }>;
  onWorkspaceChange: (workspaceId: string) => void;
  // Validation and errors
  validationError: string | null;
  error: Error | null;
}

/**
 * Report Filters Component
 */
const ReportFiltersComponent = ({
  filters,
  datePreset,
  showDatePickers,
  filterPanelExpanded,
  datePickerAnchor,
  datePickerType,
  startDateText,
  endDateText,
  activeFilters,
  hasFilters: _hasFilters,
  handleFilterChange,
  handlePresetDateRange,
  handleStartDateChange,
  handleEndDateChange,
  handleDatePickerOpen,
  handleDatePickerClose,
  handleApplyFilters,
  handleClearFilters,
  setFilterPanelExpanded,
  accountOptions,
  categoryOptions,
  payeeOptions,
  workspaces,
  selectedWorkspaceId,
  members,
  onWorkspaceChange,
  validationError,
  error,
}: ReportFiltersProps): React.JSX.Element => {
  const datePresets = getDatePresets();

  return (
    <>
      {/* Filters Section */}
      <Card sx={{ p: 3, mb: 3 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
          }}
          onClick={() => setFilterPanelExpanded(!filterPanelExpanded)}
        >
          <Typography variant="h6" component="h2">
            Filters
          </Typography>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setFilterPanelExpanded(!filterPanelExpanded);
            }}
          >
            {filterPanelExpanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>
        <Collapse in={filterPanelExpanded}>
          <Box sx={{ mt: 2 }}>
            {validationError ? (
              <Box sx={{ mb: 2, color: 'error.main' }}>
                <Typography variant="body2" color="error">
                  {validationError}
                </Typography>
              </Box>
            ) : null}
            {error ? (
              <Box sx={{ mb: 2, color: 'error.main' }}>
                <Typography variant="body2" color="error">
                  {error?.message ?? 'Error loading report data'}
                </Typography>
              </Box>
            ) : null}

            {/* Quick Date Presets */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
                Quick Date Ranges
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {(
                  [
                    'today',
                    'thisWeek',
                    'thisMonth',
                    'thisYear',
                    'lastMonth',
                    'last30Days',
                    'last90Days',
                    'custom',
                  ] as DatePreset[]
                ).map((preset) => (
                  <Button
                    key={preset}
                    variant={datePreset === preset ? 'contained' : 'outlined'}
                    size="small"
                    onClick={() => handlePresetDateRange(preset)}
                    sx={{ textTransform: 'none' }}
                  >
                    {datePresets[preset].label}
                  </Button>
                ))}
              </Box>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Workspace Selector */}
              {workspaces.length > 0 ? (
                <WorkspaceSelector value={selectedWorkspaceId} onChange={onWorkspaceChange} />
              ) : null}

              {/* Member Filter */}
              {selectedWorkspaceId && members.length > 0 ? (
                <MultiSelect
                  label="Filter by Members"
                  options={members.map((m) => ({
                    id: m.userId,
                    name: m.user.email,
                  }))}
                  value={filters.memberIds}
                  onChange={(value) => handleFilterChange('memberIds', value)}
                />
              ) : null}

              {/* Date Range - Two Separate Buttons */}
              {showDatePickers ? (
                <Grid container spacing={2}>
                  <Grid size={{ xs: 6 }}>
                    <Button
                      variant="outlined"
                      onClick={(e) => handleDatePickerOpen(e, 'start')}
                      startIcon={<CalendarToday />}
                      fullWidth
                      sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                    >
                      {startDateText}
                    </Button>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Button
                      variant="outlined"
                      onClick={(e) => handleDatePickerOpen(e, 'end')}
                      startIcon={<CalendarToday />}
                      fullWidth
                      sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                    >
                      {endDateText}
                    </Button>
                  </Grid>
                </Grid>
              ) : null}

              {/* Multi-select Filters */}
              <MultiSelect
                label="Account"
                options={accountOptions}
                value={filters.accountIds}
                onChange={(value) => handleFilterChange('accountIds', value)}
              />
              <MultiSelect
                label="Payee"
                options={payeeOptions}
                value={filters.payeeIds}
                onChange={(value) => handleFilterChange('payeeIds', value)}
              />
              <MultiSelect
                label="Category"
                options={categoryOptions}
                value={filters.categoryIds}
                onChange={(value) => handleFilterChange('categoryIds', value)}
              />

              {/* Note Search */}
              <TextField
                label="Note"
                value={filters.note}
                onChange={(e) => handleFilterChange('note', e.target.value)}
                placeholder="Search transactions by note..."
                fullWidth
              />

              {/* Apply Button */}
              <Button
                variant="contained"
                onClick={handleApplyFilters}
                fullWidth
                sx={{ textTransform: 'none', mt: 1 }}
              >
                Apply Filters
              </Button>
            </Box>
          </Box>
        </Collapse>
      </Card>

      {/* Active Filters */}
      {activeFilters.length > 0 && (
        <Card sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="subtitle2" sx={{ mr: 1, color: 'text.secondary' }}>
              Active Filters:
            </Typography>
            {activeFilters.map((filter, index) => (
              <Chip
                key={index}
                label={filter.label}
                onDelete={filter.onDelete}
                size="small"
                sx={{ textTransform: 'none' }}
              />
            ))}
            <Button
              variant="text"
              size="small"
              onClick={handleClearFilters}
              startIcon={<Clear />}
              sx={{ textTransform: 'none', ml: 'auto' }}
            >
              Clear All
            </Button>
          </Box>
        </Card>
      )}

      {/* Date Picker Popover */}
      <Popover
        open={Boolean(datePickerAnchor)}
        anchorEl={datePickerAnchor}
        onClose={handleDatePickerClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
      >
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <DateCalendar
            value={
              datePickerType === 'start' && filters.startDate
                ? dayjs(filters.startDate)
                : datePickerType === 'end' && filters.endDate
                  ? dayjs(filters.endDate)
                  : null
            }
            onChange={(newValue) => {
              if (datePickerType === 'start') {
                handleStartDateChange(newValue);
              } else if (datePickerType === 'end') {
                handleEndDateChange(newValue);
              }
            }}
          />
        </LocalizationProvider>
      </Popover>
    </>
  );
};

ReportFiltersComponent.displayName = 'ReportFilters';

export const ReportFilters = memo(ReportFiltersComponent);
