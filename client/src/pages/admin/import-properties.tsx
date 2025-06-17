import React, { useState } from 'react';
import { Button, Container, Typography, Paper, Box, CircularProgress, Alert, TextField, Divider } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';

interface ImportResult {
  reference: string;
  action: 'created' | 'updated';
  id: string;
}

interface ImportError {
  reference: string;
  error: string;
}

interface ImportResponse {
  message: string;
  total: number;
  processed: number;
  errors: number;
  results: ImportResult[];
  errorDetails: ImportError[];
}

const ImportProperties: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [xmlInput, setXmlInput] = useState<string>('');
  const [useDirectInput, setUseDirectInput] = useState(false);

  const columns: GridColDef[] = [
    { field: 'reference', headerName: 'Reference', width: 150 },
    { field: 'action', headerName: 'Action', width: 150 },
    { field: 'id', headerName: 'ID', width: 300 },
  ];

  const errorColumns: GridColDef[] = [
    { field: 'reference', headerName: 'Reference', width: 150 },
    { field: 'error', headerName: 'Error', width: 450 },
  ];

  const handleImport = async () => {
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      let url = '/api/import-properties';
      let options: RequestInit = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      };

      // If using direct XML input, send it in the request body
      if (useDirectInput && xmlInput.trim()) {
        options.method = 'POST';
        options.body = xmlInput.trim();
      }

      const res = await fetch(url, options);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to import properties');
      }

      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="lg">
      <Paper elevation={3} sx={{ p: 4, mt: 4, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Import Properties from XML
        </Typography>
        
        <Box sx={{ mb: 3 }}>
          <Typography variant="body1" paragraph>
            This tool imports property data from the Zoho XML feed at https://zoho.nordstern.ae/property_finder.xml
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Button 
              variant="contained" 
              color="primary" 
              onClick={() => setUseDirectInput(!useDirectInput)}
              sx={{ mr: 2 }}
            >
              {useDirectInput ? 'Use Remote XML' : 'Use Direct XML Input'}
            </Button>
            
            <Typography variant="body2" color="text.secondary">
              {useDirectInput ? 'Paste XML directly' : 'Import from remote URL'}
            </Typography>
          </Box>
          
          {useDirectInput && (
            <TextField
              label="XML Data"
              multiline
              rows={10}
              value={xmlInput}
              onChange={(e) => setXmlInput(e.target.value)}
              fullWidth
              variant="outlined"
              placeholder="Paste XML data here"
              sx={{ mb: 2 }}
            />
          )}
          
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleImport} 
            disabled={loading || (useDirectInput && !xmlInput.trim())}
          >
            {loading ? <CircularProgress size={24} /> : 'Import Properties'}
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {response && (
          <Box>
            <Alert 
              severity={response.errors > 0 ? 'warning' : 'success'} 
              sx={{ mb: 3 }}
            >
              {response.message}: {response.processed} of {response.total} properties processed 
              {response.errors > 0 && `, ${response.errors} errors`}
            </Alert>

            <Typography variant="h6" gutterBottom>
              Successfully Processed Properties
            </Typography>
            
            <Box sx={{ height: 400, mb: 4 }}>
              <DataGrid
                rows={response.results.map((result, index) => ({ ...result, id: index }))}
                columns={columns}
                pageSize={10}
                rowsPerPageOptions={[10]}
                disableSelectionOnClick
              />
            </Box>

            {response.errorDetails.length > 0 && (
              <>
                <Divider sx={{ my: 3 }} />
                
                <Typography variant="h6" gutterBottom>
                  Errors
                </Typography>
                
                <Box sx={{ height: 400 }}>
                  <DataGrid
                    rows={response.errorDetails.map((error, index) => ({ ...error, id: index }))}
                    columns={errorColumns}
                    pageSize={10}
                    rowsPerPageOptions={[10]}
                    disableSelectionOnClick
                  />
                </Box>
              </>
            )}
          </Box>
        )}
      </Paper>
    </Container>
  );
};

export default ImportProperties;