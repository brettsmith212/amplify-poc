/**
 * Utility functions for log parsing and message ID generation
 */

import { createHash } from 'crypto';
import { MessageType } from '../types/threadMessage';

/**
 * Generate a deterministic message ID for deduplication
 */
export function generateMessageId(
  type: MessageType,
  content: string,
  timestamp: Date
): string {
  const messageKey = `${type}_${timestamp.getTime()}_${content}`;
  return createHash('sha256').update(messageKey).digest('hex').substring(0, 16);
}

/**
 * Parse ISO timestamp string to Date object
 */
export function parseTimestamp(timestampStr: string): Date {
  try {
    const date = new Date(timestampStr);
    if (isNaN(date.getTime())) {
      // Fallback to current time if parsing fails
      return new Date();
    }
    return date;
  } catch {
    return new Date();
  }
}

/**
 * Clean and trim content for message processing
 */
export function cleanContent(content: string): string {
  if (!content || typeof content !== 'string') {
    return '';
  }
  return content.trim();
}

/**
 * Format tool usage into human-readable description
 */
export function formatToolUsage(toolName: string, input: any): string {
  switch (toolName) {
    case 'create_file':
      if (input?.path) {
        return `Creating file: ${input.path}`;
      }
      return 'Creating file';
      
    case 'edit_file':
      if (input?.path) {
        return `Editing file: ${input.path}`;
      }
      return 'Editing file';
      
    case 'Bash':
      if (input?.cmd) {
        const cmd = input.cmd.length > 100 ? `${input.cmd.substring(0, 97)}...` : input.cmd;
        return `Running command: ${cmd}`;
      }
      return 'Running command';
      
    case 'Grep':
      if (input?.pattern) {
        return `Searching for: ${input.pattern}`;
      }
      return 'Searching files';
      
    case 'read_file':
      if (input?.path) {
        return `Reading file: ${input.path}`;
      }
      return 'Reading file';
      
    case 'list_directory':
      if (input?.path) {
        return `Listing directory: ${input.path}`;
      }
      return 'Listing directory';
      
    case 'glob':
      if (input?.filePattern) {
        return `Finding files: ${input.filePattern}`;
      }
      return 'Finding files';
      
    default:
      return `Using tool: ${toolName}`;
  }
}

/**
 * Check if a string is valid JSON
 */
export function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T = any>(str: string, fallback: T): T {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/**
 * Extract files from metadata for file change tracking
 */
export function extractFilesFromMetadata(metadata: any): string[] {
  const files: string[] = [];
  
  if (metadata?.files && Array.isArray(metadata.files)) {
    files.push(...metadata.files);
  }
  
  if (metadata?.path && typeof metadata.path === 'string') {
    files.push(metadata.path);
  }
  
  if (metadata?.input?.path && typeof metadata.input.path === 'string') {
    files.push(metadata.input.path);
  }
  
  return [...new Set(files)]; // Remove duplicates
}

/**
 * Determine message metadata type based on content and context
 */
export function determineMetadataType(
  content: string,
  toolName?: string,
  exitCode?: number
): 'thinking' | 'tool_use' | 'error' | 'file_change' | undefined {
  if (exitCode !== undefined && exitCode !== 0) {
    return 'error';
  }
  
  if (toolName) {
    const fileTools = ['create_file', 'edit_file', 'read_file'];
    if (fileTools.includes(toolName)) {
      return 'file_change';
    }
    return 'tool_use';
  }
  
  // Check content patterns
  if (content.includes('thinking:') || content.startsWith('Let me think')) {
    return 'thinking';
  }
  
  if (content.includes('error') || content.includes('failed') || content.includes('Error:')) {
    return 'error';
  }
  
  return undefined;
}
