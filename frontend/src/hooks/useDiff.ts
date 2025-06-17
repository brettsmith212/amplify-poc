import { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';

export interface FileChange {
  path: string;
  type: 'added' | 'modified' | 'deleted';
  originalContent?: string;
  modifiedContent?: string;
  additions: number;
  deletions: number;
}

export interface DiffData {
  sessionId: string;
  repositoryName: string;
  branch: string;
  changes: FileChange[];
  totalAdditions: number;
  totalDeletions: number;
  lastUpdate: string;
}

export interface UseDiffReturn {
  diffData: DiffData | null;
  selectedFile: FileChange | null;
  loading: boolean;
  error: string | null;
  refreshDiff: () => Promise<void>;
  selectFile: (file: FileChange) => void;
}

export const useDiff = (sessionId: string): UseDiffReturn => {
  const [diffData, setDiffData] = useState<DiffData | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileChange | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDiffData = useCallback(async () => {
    if (!sessionId) return;

    try {
      setLoading(true);
      setError(null);

      // TODO: Replace with actual API endpoint
      const response = await api.get(`/sessions/${sessionId}/diff`);
      
      if (response.success && response.data) {
        setDiffData(response.data);
        
        // Auto-select first file if none selected
        if (!selectedFile && response.data.changes.length > 0) {
          setSelectedFile(response.data.changes[0]);
        }
      } else {
        setError(response.message || 'Failed to fetch diff data');
      }
    } catch (err: any) {
      console.error('Error fetching diff data:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }, [sessionId, selectedFile]);

  const selectFile = useCallback((file: FileChange) => {
    setSelectedFile(file);
  }, []);

  useEffect(() => {
    fetchDiffData();
  }, [fetchDiffData]);

  return {
    diffData,
    selectedFile,
    loading,
    error,
    refreshDiff: fetchDiffData,
    selectFile
  };
};

export default useDiff;
