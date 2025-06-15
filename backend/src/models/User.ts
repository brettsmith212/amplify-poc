/**
 * User data model for GitHub integration
 */

export interface User {
  id: string;
  githubId: number;
  username: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  scopes: string[];
  createdAt: Date;
  lastLoginAt: Date;
  profile: UserProfile;
  preferences: UserPreferences;
}

export interface UserProfile {
  bio?: string;
  company?: string;
  location?: string;
  blog?: string;
  twitterUsername?: string;
  publicRepos: number;
  privateRepos: number;
  followers: number;
  following: number;
}

export interface UserPreferences {
  defaultBranch?: string;
  terminalTheme?: TerminalTheme;
  editorTheme?: EditorTheme;
  sessionTimeout?: number; // in minutes
  autoSaveInterval?: number; // in seconds
  notifications: NotificationSettings;
}

export enum TerminalTheme {
  DARK = 'dark',
  LIGHT = 'light',
  HIGH_CONTRAST = 'high-contrast'
}

export enum EditorTheme {
  VS_DARK = 'vs-dark',
  VS_LIGHT = 'vs-light',
  HIGH_CONTRAST_DARK = 'hc-black',
  HIGH_CONTRAST_LIGHT = 'hc-light'
}

export interface NotificationSettings {
  sessionExpiry: boolean;
  containerErrors: boolean;
  gitOperations: boolean;
  email: boolean;
}

export interface GitHubRepository {
  id: number;
  name: string;
  fullName: string;
  description?: string;
  private: boolean;
  htmlUrl: string;
  cloneUrl: string;
  defaultBranch: string;
  language?: string;
  stargazersCount: number;
  forksCount: number;
  updatedAt: Date;
  permissions: RepositoryPermissions;
}

export interface RepositoryPermissions {
  admin: boolean;
  push: boolean;
  pull: boolean;
}

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

export interface AuthenticatedUser extends User {
  isAuthenticated: true;
}

export interface UnauthenticatedUser {
  isAuthenticated: false;
}

export type AuthUser = AuthenticatedUser | UnauthenticatedUser;
