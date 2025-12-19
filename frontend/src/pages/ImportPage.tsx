/**
 * Import Page
 * PDF upload and manual matching UI
 */

import React, {useState} from 'react';
import {Box, Typography, Alert} from '@mui/material';
import {Card} from '../components/ui/Card';
import {Button} from '../components/ui/Button';
import {validateFileType, validateFileSize} from '../utils/validation';
import {ALLOWED_FILE_TYPES, MAX_FILE_SIZE_BYTES} from '../utils/constants';

/**
 * Import Page Component
 */
export function ImportPage(): React.JSX.Element {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: {target: {files?: FileList | null} | null}): void => {
    setError(null);
    if (e.target?.files?.[0]) {
      const selectedFile = e.target.files[0];

      if (!validateFileType(selectedFile, ALLOWED_FILE_TYPES)) {
        setError('Please select a PDF file');
        return;
      }

      if (!validateFileSize(selectedFile, MAX_FILE_SIZE_BYTES)) {
        setError(`File size must be less than ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`);
        return;
      }

      setFile(selectedFile);
    }
  };

  const handleUpload = async (): Promise<void> => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    setError(null);
    setUploading(true);

    try {
      // TODO: Implement PDF upload mutation
      // const formData = new FormData();
      // formData.append('file', file);
      // await uploadPDF({ variables: { file: formData } });
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate upload
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box sx={{p: 2, maxWidth: 800, mx: 'auto'}}>
      <Typography variant="h4" gutterBottom>
        Import Transactions
      </Typography>

      <Card sx={{p: 2}}>
        <Typography variant="h6" gutterBottom>
          Upload Credit Card Statement
        </Typography>
        {error && (
          <Alert severity="error" sx={{mb: 2}} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          style={{marginBottom: '1rem'}}
        />
        <Button
          variant="contained"
          onClick={() => {
            void handleUpload();
          }}
          disabled={!file || uploading}
        >
          {uploading ? 'Uploading...' : 'Upload and Parse'}
        </Button>
      </Card>

      <Card sx={{p: 2, mt: 2}}>
        <Typography variant="h6" gutterBottom>
          Manual Matching
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Unmatched transactions will appear here for manual matching.
        </Typography>
      </Card>
    </Box>
  );
}


