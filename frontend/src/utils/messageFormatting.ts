/**
 * Format timestamp to relative time display
 */
export const formatTimestamp = (ts: string): string => {
  try {
    const date = new Date(ts);
    
    // Check if date is invalid
    if (isNaN(date.getTime())) {
      return 'unknown';
    }
    
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    
    // For dates older than 24 hours, show the date
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return 'unknown';
  }
};

/**
 * Generate a consistent message ID
 */
export const generateMessageId = (): string => {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Get display text for message metadata
 */
export const getMetadataDisplay = (metadata?: {
  type?: string;
  files?: string[];
  exitCode?: number;
}): string | null => {
  if (!metadata) return null;
  
  const { type, files, exitCode } = metadata;
  
  if (type === 'error' && exitCode !== undefined) {
    return `Command failed with exit code ${exitCode}`;
  }
  
  if (type === 'file_change' && files && files.length > 0) {
    return `Modified ${files.length} file${files.length > 1 ? 's' : ''}`;
  }
  
  if (type === 'code' && exitCode !== undefined) {
    return exitCode === 0 ? 'Command executed successfully' : `Exit code: ${exitCode}`;
  }
  
  return null;
};

/**
 * Format files list for display
 */
export const formatFilesList = (files?: string[]): string[] => {
  if (!files || files.length === 0) return [];
  
  // Sort files and limit to reasonable display count
  return files
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 10); // Limit to 10 files to avoid overwhelming UI
};
