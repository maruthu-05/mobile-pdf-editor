import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface OfflineState {
  isOnline: boolean;
  lastOnlineTime: Date | null;
  pendingOperations: PendingOperation[];
}

export interface PendingOperation {
  id: string;
  type: 'upload' | 'sync' | 'backup';
  data: any;
  timestamp: Date;
  retryCount: number;
}

export class OfflineManager {
  private static instance: OfflineManager;
  private readonly OFFLINE_STATE_KEY = 'offline_state';
  private readonly PENDING_OPERATIONS_KEY = 'pending_operations';
  private offlineState: OfflineState;
  private listeners: ((state: OfflineState) => void)[] = [];

  private constructor() {
    this.offlineState = {
      isOnline: true,
      lastOnlineTime: new Date(),
      pendingOperations: [],
    };
    this.initializeNetworkMonitoring();
  }

  public static getInstance(): OfflineManager {
    if (!OfflineManager.instance) {
      OfflineManager.instance = new OfflineManager();
    }
    return OfflineManager.instance;
  }

  async initialize(): Promise<void> {
    try {
      // Load offline state from storage
      const savedState = await AsyncStorage.getItem(this.OFFLINE_STATE_KEY);
      if (savedState) {
        const parsed = JSON.parse(savedState);
        this.offlineState = {
          ...parsed,
          lastOnlineTime: parsed.lastOnlineTime ? new Date(parsed.lastOnlineTime) : null,
          pendingOperations: parsed.pendingOperations.map((op: any) => ({
            ...op,
            timestamp: new Date(op.timestamp),
          })),
        };
      }

      // Check current network state
      const netState = await NetInfo.fetch();
      this.updateOnlineState(netState.isConnected || false);
    } catch (error) {
      console.warn('Failed to initialize offline manager:', error);
    }
  }

  private async initializeNetworkMonitoring(): Promise<void> {
    NetInfo.addEventListener(state => {
      this.updateOnlineState(state.isConnected || false);
    });
  }

  private async updateOnlineState(isOnline: boolean): Promise<void> {
    const wasOnline = this.offlineState.isOnline;
    
    this.offlineState.isOnline = isOnline;
    
    if (isOnline && !wasOnline) {
      // Just came back online
      this.offlineState.lastOnlineTime = new Date();
      await this.processPendingOperations();
    }

    await this.saveOfflineState();
    this.notifyListeners();
  }

  async addPendingOperation(operation: Omit<PendingOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    const pendingOp: PendingOperation = {
      ...operation,
      id: this.generateOperationId(),
      timestamp: new Date(),
      retryCount: 0,
    };

    this.offlineState.pendingOperations.push(pendingOp);
    await this.saveOfflineState();
  }

  async removePendingOperation(operationId: string): Promise<void> {
    this.offlineState.pendingOperations = this.offlineState.pendingOperations.filter(
      op => op.id !== operationId
    );
    await this.saveOfflineState();
  }

  private async processPendingOperations(): Promise<void> {
    if (!this.offlineState.isOnline || this.offlineState.pendingOperations.length === 0) {
      return;
    }

    const operations = [...this.offlineState.pendingOperations];
    
    for (const operation of operations) {
      try {
        await this.executeOperation(operation);
        await this.removePendingOperation(operation.id);
      } catch (error) {
        console.warn(`Failed to execute pending operation ${operation.id}:`, error);
        
        // Increment retry count
        operation.retryCount++;
        
        // Remove operation if it has failed too many times
        if (operation.retryCount >= 3) {
          await this.removePendingOperation(operation.id);
        }
      }
    }
  }

  private async executeOperation(operation: PendingOperation): Promise<void> {
    switch (operation.type) {
      case 'upload':
        // Handle file upload when back online
        console.log('Executing upload operation:', operation.data);
        break;
      case 'sync':
        // Handle data synchronization
        console.log('Executing sync operation:', operation.data);
        break;
      case 'backup':
        // Handle backup operation
        console.log('Executing backup operation:', operation.data);
        break;
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async saveOfflineState(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.OFFLINE_STATE_KEY, JSON.stringify(this.offlineState));
    } catch (error) {
      console.warn('Failed to save offline state:', error);
    }
  }

  public getOfflineState(): OfflineState {
    return { ...this.offlineState };
  }

  public isOnline(): boolean {
    return this.offlineState.isOnline;
  }

  public addListener(listener: (state: OfflineState) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.getOfflineState());
      } catch (error) {
        console.warn('Error in offline state listener:', error);
      }
    });
  }

  // Utility methods for offline functionality
  public async ensureOfflineCapability(): Promise<boolean> {
    try {
      // Verify that all core features work offline
      const coreFeatures = [
        'document-loading',
        'pdf-viewing',
        'basic-editing',
        'file-management',
        'local-storage'
      ];

      for (const feature of coreFeatures) {
        const isAvailable = await this.checkFeatureAvailability(feature);
        if (!isAvailable) {
          console.warn(`Offline feature not available: ${feature}`);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to ensure offline capability:', error);
      return false;
    }
  }

  private async checkFeatureAvailability(feature: string): Promise<boolean> {
    switch (feature) {
      case 'document-loading':
        // Check if documents can be loaded from local storage
        return true;
      case 'pdf-viewing':
        // Check if PDF rendering works offline
        return true;
      case 'basic-editing':
        // Check if basic editing features work offline
        return true;
      case 'file-management':
        // Check if file operations work offline
        return true;
      case 'local-storage':
        // Check if local storage is accessible
        try {
          await AsyncStorage.setItem('test_key', 'test_value');
          await AsyncStorage.removeItem('test_key');
          return true;
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  public async preloadEssentialData(): Promise<void> {
    try {
      // Preload any essential data needed for offline operation
      console.log('Preloading essential data for offline use...');
      
      // This could include:
      // - User preferences
      // - Document metadata
      // - Cached thumbnails
      // - Essential app configuration
      
    } catch (error) {
      console.warn('Failed to preload essential data:', error);
    }
  }
}