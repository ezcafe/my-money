/**
 * Import Upload Component
 * Handles PDF file upload with drag and drop, validation, and date format selection
 */

import React, { useState, useCallback, memo } from 'react';
import {
  Box,
  Typography,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Upload as UploadIcon,
  Description as DescriptionIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { validateFileType, validateFileSize } from '../../utils/validation';
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE_BYTES } from '../../constants';

/**
 * ImportUpload component props
 */
interface ImportUploadProps {
  file: File | null;
  dateFormat: string;
  uploading: boolean;
  error: string | null;
  successMessage: string | null;
  onFileSelect: (file: File) => void;
  onFileRemove: () => void;
  onDateFormatChange: (format: string) => void;
  onUpload: () => Promise<void>;
  onErrorDismiss: () => void;
  onSuccessDismiss: () => void;
}

/**
 * Import Upload Component
 */
const ImportUploadComponent = ({
  file,
  dateFormat,
  uploading,
  error,
  successMessage,
  onFileSelect,
  onFileRemove,
  onDateFormatChange,
  onUpload,
  onErrorDismiss,
  onSuccessDismiss,
}: ImportUploadProps): React.JSX.Element => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [isDragging, setIsDragging] = useState(false);

  /**
   * Process and validate a file
   */
  const processFile = useCallback(
    (selectedFile: File): void => {
      if (!validateFileType(selectedFile, [...ALLOWED_FILE_TYPES])) {
        return;
      }

      if (!validateFileSize(selectedFile, MAX_FILE_SIZE_BYTES)) {
        return;
      }

      onFileSelect(selectedFile);
    },
    [onFileSelect]
  );

  /**
   * Handle file input change
   */
  const handleFileChange = (e: { target: { files?: FileList | null } | null }): void => {
    if (e.target?.files?.[0]) {
      processFile(e.target.files[0]);
    }
  };

  /**
   * Handle drag over event
   */
  const handleDragOver = useCallback((e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  /**
   * Handle drag leave event
   */
  const handleDragLeave = useCallback((e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  /**
   * Handle drop event
   */
  const handleDrop = useCallback(
    (e: React.DragEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        processFile(droppedFile);
      }
    },
    [processFile]
  );

  /**
   * Format file size for display
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Card>
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" component="h2" gutterBottom>
          Upload Credit Card Statement
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Upload a PDF statement from your credit card provider. The system will automatically
          extract and categorize transactions.
        </Typography>

        {error ? (
          <Alert severity="error" sx={{ mb: 3 }} onClose={onErrorDismiss}>
            {error}
          </Alert>
        ) : null}
        {successMessage ? (
          <Alert severity="success" sx={{ mb: 3 }} onClose={onSuccessDismiss}>
            {successMessage}
          </Alert>
        ) : null}

        {/* Date Format Selection */}
        <Box sx={{ mb: 3 }}>
          <FormControl fullWidth>
            <InputLabel>Date Format in PDF</InputLabel>
            <Select
              value={dateFormat}
              label="Date Format in PDF"
              onChange={(e): void => onDateFormatChange(e.target.value)}
            >
              <MenuItem value="DD/MM/YYYY">DD/MM/YYYY</MenuItem>
              <MenuItem value="MM/DD/YYYY">MM/DD/YYYY</MenuItem>
              <MenuItem value="YYYY-MM-DD">YYYY-MM-DD</MenuItem>
              <MenuItem value="DD-MM-YYYY">DD-MM-YYYY</MenuItem>
              <MenuItem value="MM-DD-YYYY">MM-DD-YYYY</MenuItem>
            </Select>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Select the date format used in your PDF statement
            </Typography>
          </FormControl>
        </Box>

        {/* File Upload Area */}
        <Box
          onDragOver={!isMobile ? handleDragOver : undefined}
          onDragLeave={!isMobile ? handleDragLeave : undefined}
          onDrop={!isMobile ? handleDrop : undefined}
          sx={{
            border: `2px dashed ${isDragging && !isMobile ? theme.palette.primary.main : theme.palette.divider}`,
            borderRadius: 0,
            p: 4,
            textAlign: 'center',
            backgroundColor: isDragging && !isMobile ? theme.palette.action.hover : 'transparent',
            transition: 'all 0.2s ease-in-out',
            cursor: 'pointer',
            mb: 3,
          }}
          onClick={(): void => {
            document.getElementById('pdf-upload-input')?.click();
          }}
        >
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            id="pdf-upload-input"
          />
          {file ? (
            <Box>
              <CheckCircleIcon color="success" sx={{ fontSize: 48, mb: 1 }} />
              <Typography
                variant="h6"
                gutterBottom
                sx={{
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                  maxWidth: '100%',
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  px: 1,
                }}
                title={file.name}
              >
                {file.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {formatFileSize(file.size)}
              </Typography>
              <Button
                variant="outlined"
                startIcon={<CancelIcon />}
                onClick={(e): void => {
                  e.stopPropagation();
                  onFileRemove();
                }}
              >
                Remove File
              </Button>
            </Box>
          ) : (
            <Box>
              <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                {!isMobile && isDragging
                  ? 'Drop PDF file here'
                  : !isMobile
                    ? 'Drag and drop PDF file here'
                    : 'Select PDF File'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {!isMobile ? 'or click to browse' : 'Tap to browse files'}
              </Typography>
              <Button variant="outlined" startIcon={<UploadIcon />} component="span">
                Select PDF File
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                Maximum file size: {MAX_FILE_SIZE_BYTES / 1024 / 1024}MB
              </Typography>
            </Box>
          )}
        </Box>

        {/* Upload Button */}
        {file ? (
          <Box>
            {uploading ? <LinearProgress sx={{ mb: 2 }} /> : null}
            <Button
              variant="contained"
              fullWidth
              size="large"
              onClick={(): void => {
                void onUpload();
              }}
              disabled={!file || uploading}
              startIcon={uploading ? undefined : <DescriptionIcon />}
            >
              {uploading ? 'Uploading and Parsing...' : 'Upload and Parse Statement'}
            </Button>
          </Box>
        ) : null}
      </Box>
    </Card>
  );
};

ImportUploadComponent.displayName = 'ImportUpload';

export const ImportUpload = memo(ImportUploadComponent);
