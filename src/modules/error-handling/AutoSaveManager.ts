import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FileManager } from '../file-manager/FileManager';
import { ErrorHandler } from './ErrorHandler';
import { ErrorFactory } from '../../types/errors';

/**
 * Interface for auto-save data
 */
export interface AutoSaveData {
  id: string;
  type: 'merge' | 'split' | 'edit' | 'annotation';
  timestamp: Date;
  originalFiles: string[];
  workInProgress: any;
  metadata: {
    operation: string;
    progress: number;
    lastSaved: Date;
  };
}

/**
 * Auto-save functionality for work in progress
 */
export class AutoSaveManager {
  private static instance: AutoSaveManager;
  private fileManager: FileManager;
  private errorHandler: ErrorHandler;
  private autoSaveInterval: NodeJS.Timeout | null = null;
  private autoSaveEnabled = true;
  private autoSaveIntervalMs = 30000; // 30 seconds
  private maxAutoSaves = 10;
  private currentWorkSessions: Map<string, AutoSaveData> = new Map();

  private constructor() {
    this.fileManager = new FileManager();
    this.errorHandler = ErrorHandler.getInstance();
    this.initializeAutoSave();
  }

  static getInstance(): AutoSaveManager {
    if (!AutoSaveManager.instance) {
      AutoSaveManager.instance = new AutoSaveManager();
    }
    return AutoSaveManager.instance;
  }

  /**
   * Initialize auto-save system
   */
  private async initializeAutoSave(): Promise<void> {
    try {
      // Load existing auto-save sessions
      await this.loadAutoSaveSessions();
      
      // Start auto-save timer
      this.startAutoSaveTimer();
    } catch (error) {
      this.errorHandler.logError(
        ErrorFactory.createFileSystemError(
          'file_corruption',
          `Failed to initialize auto-save: ${error instanceof Error ? error.message : 'Unknown error'}`,
          undefined,
          error
        )
      );
    }
  }

  /**
   * Start a new work session for auto-saving
   */
  async startWorkSession(
    type: AutoSaveData['type'],
    originalFiles: string[],
    operation: string
  ): Promise<string> {
    try {
      const sessionId = this.generateSessionId();
      const autoSaveData: AutoSaveData = {
        id: sessionId,
        type,
        timestamp: new Date(),
        originalFiles: [...originalFiles],
        workInProgress: {},
        metadata: {
          operation,
          progress: 0,
          lastSaved: new Date(),
        },
      };

      this.currentWorkSessions.set(sessionId, autoSaveData);
      await this.saveAutoSaveSession(autoSaveData);

      return sessionId;
    } catch (error) {
      this.errorHandler.logError(
        ErrorFactory.createFileSystemError(
          'file_corruption',
          `Failed to start work session: ${error instanceof Error ? error.message : 'Unknown error'}`,
          undefined,
          error
        )
      );
      throw error;
    }
  }

  /**
   * Update work in progress for a session
   */
  async updateWorkInProgress(
    sessionId: string,
    workData: any,
    progress: number = 0
  ): Promise<void> {
    try {
      const session = this.currentWorkSessions.get(sessionId);
      if (!session) {
        throw new Error(`Work session not found: ${sessionId}`);
      }

      session.workInProgress = { ...session.workInProgress, ...workData };
      session.metadata.progress = progress;
      session.metadata.lastSaved = new Date();

      this.currentWorkSessions.set(sessionId, session);

      // Save immediately for important updates
      if (progress > 0) {
        await this.saveAutoSaveSession(session);
      }
    } catch (error) {
      this.errorHandler.logError(
        ErrorFactory.createFileSystemError(
          'file_corruption',
          `Failed to update work in progress: ${error instanceof Error ? error.message : 'Unknown error'}`,
          sessionId,
          error
        )
      );
    }
  }

  /**
   * Complete a work session (remove auto-save data)
   */
  async completeWorkSession(sessionId: string): Promise<void> {
    try {
      const session = this.currentWorkSessions.get(sessionId);
      if (session) {
        this.currentWorkSessions.delete(sessionId);
        await this.removeAutoSaveSession(sessionId);
      }
    } catch (error) {
      this.errorHandler.logError(
        ErrorFactory.createFileSystemError(
          'file_corruption',
          `Failed to complete work session: ${error instanceof Error ? error.message : 'Unknown error'}`,
          sessionId,
          error
        )
      );
    }
  }

  /**
   * Get all auto-save sessions
   */
  async getAutoSaveSessions(): Promise<AutoSaveData[]> {
    try {
      const sessions = Array.from(this.currentWorkSessions.values());
      return sessions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      this.errorHandler.logError(
        ErrorFactory.createFileSystemError(
          'file_corruption',
          `Failed to get auto-save sessions: ${error instanceof Error ? error.message : 'Unknown error'}`,
          undefined,
          error
        )
      );
      return [];
    }
  }

  /**
   * Recover work from an auto-save session
   */
  async recoverWorkSession(sessionId: string): Promise<AutoSaveData | null> {
    try {
      const session = this.currentWorkSessions.get(sessionId);
      if (!session) {
        // Try to load from storage
        const savedSession = await this.loadAutoSaveSession(sessionId);
        if (savedSession) {
          this.currentWorkSessions.set(sessionId, savedSession);
          return savedSession;
        }
        return null;
      }
      return session;
    } catch (error) {
      this.errorHandler.logError(
        ErrorFactory.createFileSystemError(
          'file_corruption',
          `Failed to recover work session: ${error instanceof Error ? error.message : 'Unknown error'}`,
          sessionId,
          error
        )
      );
      return null;
    }
  }

  /**
   * Clean up old auto-save sessions
   */
  async cleanupOldSessions(maxAge: number = 24 * 60 * 60 * 1000): Promise<void> {
    try {
      const now = new Date().getTime();
      const sessionsToRemove: string[] = [];

      for (const [sessionId, session] of this.currentWorkSessions) {
        if (now - session.timestamp.getTime() > maxAge) {
          sessionsToRemove.push(sessionId);
        }
      }

      for (const sessionId of sessionsToRemove) {
        await this.removeAutoSaveSession(sessionId);
        this.currentWorkSessions.delete(sessionId);
      }
    } catch (error) {
      this.errorHandler.logError(
        ErrorFactory.createFileSystemError(
          'file_corruption',
          `Failed to cleanup old sessions: ${error instanceof Error ? error.message : 'Unknown error'}`,
          undefined,
          error
        )
      );
    }
  }

  /**
   * Enable or disable auto-save
   */
  setAutoSaveEnabled(enabled: boolean): void {
    this.autoSaveEnabled = enabled;
    
    if (enabled) {
      this.startAutoSaveTimer();
    } else {
      this.stopAutoSaveTimer();
    }
  }

  /**
   * Set auto-save interval
   */
  setAutoSaveInterval(intervalMs: number): void {
    this.autoSaveIntervalMs = intervalMs;
    
    if (this.autoSaveEnabled) {
      this.stopAutoSaveTimer();
      this.startAutoSaveTimer();
    }
  }

  /**
   * Get auto-save statistics
   */
  getAutoSaveStats(): {
    activeSessions: number;
    totalSessions: number;
    lastAutoSave: Date | null;
    autoSaveEnabled: boolean;
  } {
    const sessions = Array.from(this.currentWorkSessions.values());
    const lastAutoSave = sessions.length > 0 
      ? sessions.reduce((latest, session) => 
          session.metadata.lastSaved > latest ? session.metadata.lastSaved : latest,
          sessions[0].metadata.lastSaved
        )
      : null;

    return {
      activeSessions: this.currentWorkSessions.size,
      totalSessions: sessions.length,
      lastAutoSave,
      autoSaveEnabled: this.autoSaveEnabled,
    };
  }

  /**
   * Private methods
   */

  private startAutoSaveTimer(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }

    this.autoSaveInterval = setInterval(async () => {
      if (this.autoSaveEnabled && this.currentWorkSessions.size > 0) {
        await this.performAutoSave();
      }
    }, this.autoSaveIntervalMs);
  }

  private stopAutoSaveTimer(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  private async performAutoSave(): Promise<void> {
    try {
      for (const session of this.currentWorkSessions.values()) {
        await this.saveAutoSaveSession(session);
      }
    } catch (error) {
      this.errorHandler.logError(
        ErrorFactory.createFileSystemError(
          'file_corruption',
          `Auto-save failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          undefined,
          error
        )
      );
    }
  }

  private async saveAutoSaveSession(session: AutoSaveData): Promise<void> {
    const key = `autosave_${session.id}`;
    const data = JSON.stringify({
      ...session,
      timestamp: session.timestamp.toISOString(),
      metadata: {
        ...session.metadata,
        lastSaved: session.metadata.lastSaved.toISOString(),
      },
    });

    await AsyncStorage.setItem(key, data);
  }

  private async loadAutoSaveSession(sessionId: string): Promise<AutoSaveData | null> {
    try {
      const key = `autosave_${sessionId}`;
      const data = await AsyncStorage.getItem(key);
      
      if (!data) {
        return null;
      }

      const parsed = JSON.parse(data);
      return {
        ...parsed,
        timestamp: new Date(parsed.timestamp),
        metadata: {
          ...parsed.metadata,
          lastSaved: new Date(parsed.metadata.lastSaved),
        },
      };
    } catch (error) {
      return null;
    }
  }

  private async loadAutoSaveSessions(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const autoSaveKeys = keys.filter(key => key.startsWith('autosave_'));

      for (const key of autoSaveKeys) {
        const sessionId = key.replace('autosave_', '');
        const session = await this.loadAutoSaveSession(sessionId);
        
        if (session) {
          this.currentWorkSessions.set(sessionId, session);
        }
      }

      // Clean up old sessions on startup
      await this.cleanupOldSessions();
    } catch (error) {
      console.warn('Failed to load auto-save sessions:', error);
    }
  }

  private async removeAutoSaveSession(sessionId: string): Promise<void> {
    const key = `autosave_${sessionId}`;
    await AsyncStorage.removeItem(key);
  }

  private generateSessionId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}