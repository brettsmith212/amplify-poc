/**
 * Jest test setup
 */

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.COOKIE_SECRET = 'test-cookie-secret';
process.env.GITHUB_CLIENT_ID = 'test-client-id';
process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';

// Increase test timeout for integration tests
jest.setTimeout(30000);

// Mock external services
jest.mock('../services/github', () => ({
  createGitHubService: jest.fn(),
  GitHubService: jest.fn().mockImplementation(() => ({
    getRepositories: jest.fn(),
    getBranches: jest.fn(),
    getRepository: jest.fn(),
    searchRepositories: jest.fn(),
    getRateLimit: jest.fn()
  }))
}));

jest.mock('../docker/containerManager', () => ({
  ContainerManager: jest.fn().mockImplementation(() => ({
    createContainer: jest.fn(),
    startContainer: jest.fn(),
    stopContainer: jest.fn(),
    cleanup: jest.fn()
  }))
}));
