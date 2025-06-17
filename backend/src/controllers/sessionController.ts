/**
 * Session controller with GitHub integration and business logic
 */

import { AuthenticatedUser } from '../models/User';
import { Session, SessionStatus } from '../models/Session';
import { sessionStore } from '../services/sessionStore';
import { ContainerManager } from '../docker/containerManager';
import { createGitHubApiService } from '../services/githubApi';

import { logger } from '../utils/logger';

const sessionControllerLogger = logger.child('SessionController');

export interface SessionData {
  repositoryUrl: string;
  branch: string;
  prompt: string;
  sessionName: string;
}

export interface SessionUpdateData {
  sessionName?: string;
  prompt?: string;
}

export interface SessionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Get all sessions for a user
 */
export async function getUserSessions(userId: string): Promise<SessionResult<Session[]>> {
  try {
    sessionControllerLogger.debug('Getting user sessions', { userId });

    const sessionSummaries = sessionStore.getUserSessions(userId);
    
    // Convert SessionSummary[] to Session[] by getting full session data
    const sessions: Session[] = [];
    for (const summary of sessionSummaries) {
      const fullSession = sessionStore.getSession(summary.id);
      if (fullSession) {
        sessions.push(fullSession);
      }
    }
    
    sessionControllerLogger.info('Retrieved user sessions', {
      userId,
      sessionCount: sessions.length
    });

    return {
      success: true,
      data: sessions
    };

  } catch (error: any) {
    sessionControllerLogger.error('Failed to get user sessions', {
      userId,
      error: error.message
    });

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Create a new session with GitHub repository cloning
 */
export async function createSession(
  user: AuthenticatedUser, 
  sessionData: SessionData
): Promise<SessionResult<Session>> {
  try {
    sessionControllerLogger.info('Creating new session', {
      userId: user.id,
      repositoryUrl: sessionData.repositoryUrl,
      branch: sessionData.branch,
      sessionName: sessionData.sessionName
    });

    // Step 1: Validate GitHub repository access
    const githubApi = createGitHubApiService(user);
    const repoUrl = sessionData.repositoryUrl;
    
    // Extract owner and repo from URL
    const repoMatch = repoUrl.match(/github\.com[/:]([\w-]+)\/([\w.-]+?)(?:\.git)?(?:\/)?$/);
    if (!repoMatch) {
      return {
        success: false,
        error: 'Invalid GitHub repository URL. Please provide a valid GitHub repository URL.'
      };
    }

    const [, owner, repoName] = repoMatch;
    
    if (!owner || !repoName) {
      return {
        success: false,
        error: 'Unable to extract owner and repository name from URL'
      };
    }
    
    sessionControllerLogger.debug('Validating repository access', {
      userId: user.id,
      owner,
      repo: repoName
    });

    // Validate repository access
    const accessResult = await githubApi.validateRepositoryAccess(owner, repoName);
    if (accessResult.error) {
      sessionControllerLogger.warn('Repository access validation failed', {
        userId: user.id,
        owner,
        repo: repoName,
        error: accessResult.error
      });

      return {
        success: false,
        error: `Repository access denied: ${accessResult.error}`
      };
    }

    // Step 2: Validate branch exists
    const branchesResult = await githubApi.getBranches(owner, repoName);
    if (!branchesResult.success) {
      return {
        success: false,
        error: `Failed to fetch branches: ${branchesResult.error}`
      };
    }

    const branchExists = branchesResult.data?.some(branch => branch.name === sessionData.branch);
    if (!branchExists) {
      return {
        success: false,
        error: `Branch '${sessionData.branch}' not found in repository '${owner}/${repoName}'`
      };
    }

    // Step 3: Check session limits
    const userSessions = sessionStore.getUserSessions(user.id);
    const maxSessions = 10; // From config
    
    if (userSessions.length >= maxSessions) {
      return {
        success: false,
        error: `Maximum number of sessions (${maxSessions}) reached. Please delete some sessions first.`
      };
    }

    // Step 4: Create session
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const session: Session = {
      id: sessionId,
      userId: user.id,
      repositoryUrl: sessionData.repositoryUrl,
      repositoryName: `${owner}/${repoName}`,
      branch: sessionData.branch,
      initialPrompt: sessionData.prompt,
      status: SessionStatus.READY,

      createdAt: new Date(),
      lastAccessedAt: new Date(),
      expiresAt: new Date(Date.now() + 14400000), // 4 hours default TTL
      metadata: {
        tags: []
      }
    };

    // Store session
    sessionStore.createSession(session);

    sessionControllerLogger.info('Session created successfully', {
      userId: user.id,
      sessionId,
      repositoryUrl: sessionData.repositoryUrl,
      branch: sessionData.branch
    });

    return {
      success: true,
      data: session
    };

  } catch (error: any) {
    sessionControllerLogger.error('Failed to create session', {
      userId: user.id,
      sessionData,
      error: error.message,
      stack: error.stack
    });

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get a session by ID (with ownership validation)
 */
export async function getSessionById(userId: string, sessionId: string): Promise<SessionResult<Session>> {
  try {
    sessionControllerLogger.debug('Getting session by ID', { userId, sessionId });

    const session = sessionStore.getSession(sessionId);
    
    if (!session) {
      return {
        success: false,
        error: 'Session not found'
      };
    }

    // Validate ownership
    if (session.userId !== userId) {
      sessionControllerLogger.warn('Session access denied - ownership mismatch', {
        userId,
        sessionId,
        sessionUserId: session.userId
      });

      return {
        success: false,
        error: 'Session not found' // Don't reveal existence to non-owners
      };
    }

    // Update last accessed time
    sessionStore.updateSession(sessionId, { lastAccessedAt: new Date() });

    return {
      success: true,
      data: session
    };

  } catch (error: any) {
    sessionControllerLogger.error('Failed to get session by ID', {
      userId,
      sessionId,
      error: error.message
    });

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Update a session
 */
export async function updateSession(
  userId: string, 
  sessionId: string, 
  updateData: SessionUpdateData
): Promise<SessionResult<Session>> {
  try {
    sessionControllerLogger.info('Updating session', { userId, sessionId, updateData });

    // Get and validate session
    const sessionResult = await getSessionById(userId, sessionId);
    if (!sessionResult.success || !sessionResult.data) {
      return sessionResult;
    }

    const session = sessionResult.data;

    // Update allowed fields (map to actual Session model fields)
    const updates: Partial<Session> = {};
    
    if (updateData.sessionName !== undefined) {
      // Session model doesn't have a name field, store in metadata
      updates.metadata = {
        ...session.metadata,
        tags: [...(session.metadata.tags || []), updateData.sessionName]
      };
    }
    
    if (updateData.prompt !== undefined) {
      updates.initialPrompt = updateData.prompt;
    }

    if (Object.keys(updates).length === 0) {
      return {
        success: false,
        error: 'No valid fields to update'
      };
    }

    // Apply updates
    sessionStore.updateSession(sessionId, updates);
    
    // Get updated session
    const updatedSession = sessionStore.getSession(sessionId);
    
    if (!updatedSession) {
      return {
        success: false,
        error: 'Session not found after update'
      };
    }

    sessionControllerLogger.info('Session updated successfully', {
      userId,
      sessionId,
      updates: Object.keys(updates)
    });

    return {
      success: true,
      data: updatedSession
    };

  } catch (error: any) {
    sessionControllerLogger.error('Failed to update session', {
      userId,
      sessionId,
      updateData,
      error: error.message
    });

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Delete a session and cleanup associated resources
 */
export async function deleteSession(userId: string, sessionId: string): Promise<SessionResult<void>> {
  try {
    sessionControllerLogger.info('Deleting session', { userId, sessionId });

    // Get and validate session
    const sessionResult = await getSessionById(userId, sessionId);
    if (!sessionResult.success || !sessionResult.data) {
      return {
        success: false,
        error: sessionResult.error || 'Session not found'
      };
    }

    const session = sessionResult.data;
    const containerManager = new ContainerManager();

    // Stop and cleanup container if it exists
    if (session.containerId) {
      try {
        await containerManager.stopContainer(session.containerId);
        
        sessionControllerLogger.info('Container cleaned up during session deletion', {
          userId,
          sessionId,
          containerId: session.containerId
        });
      } catch (containerError: any) {
        sessionControllerLogger.warn('Failed to cleanup container during session deletion', {
          userId,
          sessionId,
          containerId: session.containerId,
          error: containerError.message
        });
        // Continue with session deletion even if container cleanup fails
      }
    }

    // Remove session from store
    sessionStore.deleteSession(sessionId);

    sessionControllerLogger.info('Session deleted successfully', {
      userId,
      sessionId
    });

    return {
      success: true
    };

  } catch (error: any) {
    sessionControllerLogger.error('Failed to delete session', {
      userId,
      sessionId,
      error: error.message
    });

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Start/resume a session (creates or reconnects to container)
 */
export async function startSession(userId: string, sessionId: string): Promise<SessionResult<{
  sessionId: string;
  containerId: string;
  status: string;
  workingDirectory: string;
}>> {
  try {
    sessionControllerLogger.info('Starting session', { userId, sessionId });

    // Get and validate session
    const sessionResult = await getSessionById(userId, sessionId);
    if (!sessionResult.success || !sessionResult.data) {
      return {
        success: false,
        error: sessionResult.error || 'Session not found'
      };
    }

    const session = sessionResult.data;
    const containerManager = new ContainerManager();

    // If container already exists and is running, return its info
    if (session.containerId) {
      try {
        const containerInfo = await containerManager.getContainerInfo(session.containerId);
        if (containerInfo && containerInfo.status === 'running') {
          sessionControllerLogger.info('Session container already running', {
            userId,
            sessionId,
            containerId: session.containerId
          });

          return {
            success: true,
            data: {
              sessionId,
              containerId: session.containerId,
              status: 'running',
              workingDirectory: `/workspace/${sessionId}`
            }
          };
        }
      } catch (inspectError: any) {
        sessionControllerLogger.warn('Failed to inspect existing container, will create new one', {
          userId,
          sessionId,
          containerId: session.containerId,
          error: inspectError.message
        });
      }
    }

    // Create and start container (repository cloning happens inside container via entrypoint)
    sessionControllerLogger.info('Creating container for session', {
      userId,
      sessionId,
      repositoryUrl: session.repositoryUrl,
      branch: session.branch
    });

    const containerResult = await containerManager.createContainer({
      sessionId,
      workspaceDir: `/workspace/${sessionId}`, // Not used since no volume mount, but keep for compatibility
      environment: {
        SESSION_ID: sessionId,
        USER_ID: userId,
        REPOSITORY_URL: session.repositoryUrl,
        REPOSITORY_BRANCH: session.branch,
        SESSION_PROMPT: session.initialPrompt,
        // Pass AMP_API_KEY if available
        ...(process.env.AMP_API_KEY && { AMP_API_KEY: process.env.AMP_API_KEY })
      },
      baseImage: 'amplify-base'
    });

    if (!containerResult.success || !containerResult.container) {
      return {
        success: false,
        error: `Failed to create container: ${containerResult.error}`
      };
    }

    // Start the container
    const startResult = await containerManager.startContainer(containerResult.container.id);
    if (!startResult.success) {
      return {
        success: false,
        error: `Failed to start container: ${startResult.error}`
      };
    }

    // Update session with container info
    sessionStore.updateSession(sessionId, {
      containerId: containerResult.container.id,
      containerName: containerResult.container.name,
      status: SessionStatus.RUNNING,
      lastAccessedAt: new Date()
    });

    sessionControllerLogger.info('Session started successfully', {
      userId,
      sessionId,
      containerId: containerResult.container.id,
      containerName: containerResult.container.name
    });

    return {
      success: true,
      data: {
        sessionId,
        containerId: containerResult.container.id,
        status: 'running',
        workingDirectory: `/workspace/${sessionId}`
      }
    };

  } catch (error: any) {
    sessionControllerLogger.error('Failed to start session', {
      userId,
      sessionId,
      error: error.message,
      stack: error.stack
    });

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Stop a session (stops container but keeps session data)
 */
export async function stopSession(userId: string, sessionId: string): Promise<SessionResult<void>> {
  try {
    sessionControllerLogger.info('Stopping session', { userId, sessionId });

    // Get and validate session
    const sessionResult = await getSessionById(userId, sessionId);
    if (!sessionResult.success || !sessionResult.data) {
      return {
        success: false,
        error: sessionResult.error || 'Session not found'
      };
    }

    const session = sessionResult.data;

    if (!session.containerId) {
      return {
        success: false,
        error: 'Session has no running container'
      };
    }

    const containerManager = new ContainerManager();

    // Stop container
    await containerManager.stopContainer(session.containerId);

    // Update session status
    sessionStore.updateSession(sessionId, {
      status: SessionStatus.STOPPED
    });

    sessionControllerLogger.info('Session stopped successfully', {
      userId,
      sessionId,
      containerId: session.containerId
    });

    return {
      success: true
    };

  } catch (error: any) {
    sessionControllerLogger.error('Failed to stop session', {
      userId,
      sessionId,
      error: error.message
    });

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get the current status of a session
 */
export async function getSessionStatus(userId: string, sessionId: string): Promise<SessionResult<{
  sessionId: string;
  status: SessionStatus;
  container: {
    id: string | null;
    status: string;
    running: boolean;
  };
  repository: {
    cloned: boolean;
    lastSync: Date | null;
  };
  lastAccessed: Date;
}>> {
  try {
    sessionControllerLogger.debug('Getting session status', { userId, sessionId });

    // Get and validate session
    const sessionResult = await getSessionById(userId, sessionId);
    if (!sessionResult.success || !sessionResult.data) {
      return {
        success: false,
        error: sessionResult.error || 'Session not found'
      };
    }

    const session = sessionResult.data;
    const containerManager = new ContainerManager();

    let containerRunning = false;
    
    // Check actual container status if container exists
    if (session.containerId) {
      try {
        const containerInfo = await containerManager.getContainerInfo(session.containerId);
        containerRunning = containerInfo?.status === 'running';
        
        // Update session container status if it differs
        const expectedStatus = containerRunning ? SessionStatus.RUNNING : SessionStatus.STOPPED;
        if (expectedStatus !== session.status) {
          sessionStore.updateSession(sessionId, {
            status: expectedStatus
          });
        }
      } catch (inspectError: any) {
        sessionControllerLogger.debug('Container no longer exists or accessible', {
          userId,
          sessionId,
          containerId: session.containerId,
          error: inspectError.message
        });
        
        // Container doesn't exist, update session
        sessionStore.updateSession(sessionId, {
          status: SessionStatus.STOPPED
        });
      }
    }

    return {
      success: true,
      data: {
        sessionId,
        status: session.status,
        container: {
          id: session.containerId || null,
          status: containerRunning ? 'running' : 'stopped',
          running: containerRunning
        },
        repository: {
          cloned: !!session.metadata.gitCommitHash,
          lastSync: null // Not tracked in current model
        },
        lastAccessed: session.lastAccessedAt
      }
    };

  } catch (error: any) {
    sessionControllerLogger.error('Failed to get session status', {
      userId,
      sessionId,
      error: error.message
    });

    return {
      success: false,
      error: error.message
    };
  }
}
