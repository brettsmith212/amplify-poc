import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  formatTimestamp, 
  generateMessageId, 
  getMetadataDisplay, 
  formatFilesList 
} from '../../utils/messageFormatting';

describe('messageFormatting', () => {
  describe('formatTimestamp', () => {
    beforeEach(() => {
      // Mock current time to 2023-01-01T12:00:00Z
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2023-01-01T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns "just now" for very recent timestamps', () => {
      const result = formatTimestamp('2023-01-01T12:00:00Z');
      expect(result).toBe('just now');
    });

    it('returns minutes ago for recent timestamps', () => {
      const result = formatTimestamp('2023-01-01T11:45:00Z'); // 15 minutes ago
      expect(result).toBe('15m ago');
    });

    it('returns hours ago for older timestamps', () => {
      const result = formatTimestamp('2023-01-01T10:00:00Z'); // 2 hours ago
      expect(result).toBe('2h ago');
    });

    it('returns formatted date for very old timestamps', () => {
      const result = formatTimestamp('2022-12-31T12:00:00Z'); // 24+ hours ago
      expect(result).toMatch(/Dec 31.*[0-9]{1,2}:[0-9]{2}/); // Should contain date and time
    });

    it('handles invalid timestamp gracefully', () => {
      const result = formatTimestamp('invalid-date');
      expect(result).toBe('unknown');
    });

    it('handles empty string', () => {
      const result = formatTimestamp('');
      expect(result).toBe('unknown');
    });
  });

  describe('generateMessageId', () => {
    it('generates unique IDs', () => {
      const id1 = generateMessageId();
      const id2 = generateMessageId();
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^msg_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^msg_\d+_[a-z0-9]+$/);
    });

    it('generates IDs with correct format', () => {
      const id = generateMessageId();
      
      expect(id).toMatch(/^msg_\d+_[a-z0-9]{9}$/);
    });
  });

  describe('getMetadataDisplay', () => {
    it('returns null for undefined metadata', () => {
      const result = getMetadataDisplay(undefined);
      expect(result).toBeNull();
    });

    it('returns null for empty metadata', () => {
      const result = getMetadataDisplay({});
      expect(result).toBeNull();
    });

    it('returns error message for error type with exit code', () => {
      const result = getMetadataDisplay({ 
        type: 'error', 
        exitCode: 1 
      });
      expect(result).toBe('Command failed with exit code 1');
    });

    it('returns file change message for single file', () => {
      const result = getMetadataDisplay({ 
        type: 'file_change', 
        files: ['src/component.tsx'] 
      });
      expect(result).toBe('Modified 1 file');
    });

    it('returns file change message for multiple files', () => {
      const result = getMetadataDisplay({ 
        type: 'file_change', 
        files: ['src/component.tsx', 'src/utils.ts'] 
      });
      expect(result).toBe('Modified 2 files');
    });

    it('returns success message for code type with exit code 0', () => {
      const result = getMetadataDisplay({ 
        type: 'code', 
        exitCode: 0 
      });
      expect(result).toBe('Command executed successfully');
    });

    it('returns exit code message for code type with non-zero exit code', () => {
      const result = getMetadataDisplay({ 
        type: 'code', 
        exitCode: 2 
      });
      expect(result).toBe('Exit code: 2');
    });

    it('handles file_change without files array', () => {
      const result = getMetadataDisplay({ 
        type: 'file_change' 
      });
      expect(result).toBeNull();
    });

    it('handles file_change with empty files array', () => {
      const result = getMetadataDisplay({ 
        type: 'file_change', 
        files: [] 
      });
      expect(result).toBeNull();
    });
  });

  describe('formatFilesList', () => {
    it('returns empty array for undefined files', () => {
      const result = formatFilesList(undefined);
      expect(result).toEqual([]);
    });

    it('returns empty array for empty files array', () => {
      const result = formatFilesList([]);
      expect(result).toEqual([]);
    });

    it('sorts files alphabetically', () => {
      const files = ['z-file.ts', 'a-file.ts', 'm-file.ts'];
      const result = formatFilesList(files);
      
      expect(result).toEqual(['a-file.ts', 'm-file.ts', 'z-file.ts']);
    });

    it('limits to 10 files', () => {
      const files = Array.from({ length: 15 }, (_, i) => `file${i}.ts`);
      const result = formatFilesList(files);
      
      expect(result).toHaveLength(10);
      expect(result[0]).toBe('file0.ts');
      // Files are sorted alphabetically, so file4.ts comes before file9.ts
      expect(result[9]).toBe('file4.ts');
    });

    it('preserves all files when less than or equal to 10', () => {
      const files = ['file1.ts', 'file2.ts', 'file3.ts'];
      const result = formatFilesList(files);
      
      expect(result).toEqual(['file1.ts', 'file2.ts', 'file3.ts']);
    });

    it('handles files with similar names correctly', () => {
      const files = ['file10.ts', 'file2.ts', 'file1.ts'];
      const result = formatFilesList(files);
      
      // Should be sorted alphabetically, not numerically
      expect(result).toEqual(['file1.ts', 'file10.ts', 'file2.ts']);
    });
  });
});
