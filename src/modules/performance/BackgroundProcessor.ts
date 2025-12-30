/**
 * Background task types
 */
export type TaskType = 'merge' | 'split' | 'render' | 'thumbnail' | 'extract' | 'delete';

/**
 * Task priority levels
 */
export type TaskPriority = 'high' | 'medium' | 'low';

/**
 * Task status
 */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Background task definition
 */
export interface BackgroundTask<T = any, R = any> {
  id: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  progress: number;
  data: T;
  result?: R;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  onProgress?: (progress: number, message?: string) => void;
  onComplete?: (result: R) => void;
  onError?: (error: string) => void;
}

/**
 * Task execution function
 */
export type TaskExecutor<T, R> = (
  data: T,
  onProgress: (progress: number, message?: string) => void,
  signal: AbortSignal
) => Promise<R>;

/**
 * Background processor for heavy PDF operations
 */
export class BackgroundProcessor {
  private static instance: BackgroundProcessor;
  private tasks = new Map<string, BackgroundTask>();
  private taskQueue: BackgroundTask[] = [];
  private runningTasks = new Map<string, AbortController>();
  private isProcessing = false;
  private maxConcurrentTasks = 2;
  
  // Task executors
  private executors = new Map<TaskType, TaskExecutor<any, any>>();
  
  // Event callbacks
  public onTaskAdded?: (task: BackgroundTask) => void;
  public onTaskStarted?: (task: BackgroundTask) => void;
  public onTaskProgress?: (task: BackgroundTask) => void;
  public onTaskCompleted?: (task: BackgroundTask) => void;
  public onTaskFailed?: (task: BackgroundTask) => void;
  public onTaskCancelled?: (task: BackgroundTask) => void;

  private constructor() {
    this.startProcessing();
  }

  static getInstance(): BackgroundProcessor {
    if (!BackgroundProcessor.instance) {
      BackgroundProcessor.instance = new BackgroundProcessor();
    }
    return BackgroundProcessor.instance;
  }

  /**
   * Register a task executor for a specific task type
   */
  registerExecutor<T, R>(taskType: TaskType, executor: TaskExecutor<T, R>): void {
    this.executors.set(taskType, executor);
  }

  /**
   * Add a task to the background queue
   */
  addTask<T, R>(
    type: TaskType,
    data: T,
    priority: TaskPriority = 'medium',
    callbacks?: {
      onProgress?: (progress: number, message?: string) => void;
      onComplete?: (result: R) => void;
      onError?: (error: string) => void;
    }
  ): string {
    const taskId = this.generateTaskId();
    
    const task: BackgroundTask<T, R> = {
      id: taskId,
      type,
      priority,
      status: 'pending',
      progress: 0,
      data,
      createdAt: new Date(),
      onProgress: callbacks?.onProgress,
      onComplete: callbacks?.onComplete,
      onError: callbacks?.onError
    };

    this.tasks.set(taskId, task);
    this.addToQueue(task);
    
    this.onTaskAdded?.(task);
    
    return taskId;
  }

  /**
   * Cancel a task
   */
  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    if (task.status === 'running') {
      // Cancel running task
      const controller = this.runningTasks.get(taskId);
      if (controller) {
        controller.abort();
        this.runningTasks.delete(taskId);
      }
    } else if (task.status === 'pending') {
      // Remove from queue
      const queueIndex = this.taskQueue.findIndex(t => t.id === taskId);
      if (queueIndex !== -1) {
        this.taskQueue.splice(queueIndex, 1);
      }
    }

    task.status = 'cancelled';
    task.completedAt = new Date();
    
    this.onTaskCancelled?.(task);
    
    return true;
  }

  /**
   * Get task status
   */
  getTask(taskId: string): BackgroundTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): BackgroundTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get tasks by status
   */
  getTasksByStatus(status: TaskStatus): BackgroundTask[] {
    return Array.from(this.tasks.values()).filter(task => task.status === status);
  }

  /**
   * Get tasks by type
   */
  getTasksByType(type: TaskType): BackgroundTask[] {
    return Array.from(this.tasks.values()).filter(task => task.type === type);
  }

  /**
   * Clear completed and failed tasks
   */
  clearCompletedTasks(): void {
    const tasksToRemove: string[] = [];
    
    for (const [taskId, task] of this.tasks) {
      if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
        tasksToRemove.push(taskId);
      }
    }
    
    tasksToRemove.forEach(taskId => this.tasks.delete(taskId));
  }

  /**
   * Get queue statistics
   */
  getQueueStats() {
    const pending = this.getTasksByStatus('pending').length;
    const running = this.getTasksByStatus('running').length;
    const completed = this.getTasksByStatus('completed').length;
    const failed = this.getTasksByStatus('failed').length;
    const cancelled = this.getTasksByStatus('cancelled').length;
    
    return {
      pending,
      running,
      completed,
      failed,
      cancelled,
      total: this.tasks.size,
      queueLength: this.taskQueue.length
    };
  }

  /**
   * Add task to queue with priority sorting
   */
  private addToQueue(task: BackgroundTask): void {
    // Insert task based on priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    let insertIndex = this.taskQueue.length;
    
    for (let i = 0; i < this.taskQueue.length; i++) {
      if (priorityOrder[task.priority] < priorityOrder[this.taskQueue[i].priority]) {
        insertIndex = i;
        break;
      }
    }
    
    this.taskQueue.splice(insertIndex, 0, task);
  }

  /**
   * Start processing tasks
   */
  private startProcessing(): void {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    this.processQueue();
  }

  /**
   * Process the task queue
   */
  private async processQueue(): Promise<void> {
    while (this.isProcessing) {
      // Check if we can start more tasks
      if (this.runningTasks.size >= this.maxConcurrentTasks || this.taskQueue.length === 0) {
        // Wait a bit before checking again
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }

      // Get next task from queue
      const task = this.taskQueue.shift();
      if (!task) {
        continue;
      }

      // Start executing the task
      this.executeTask(task);
    }
  }

  /**
   * Execute a single task
   */
  private async executeTask(task: BackgroundTask): Promise<void> {
    const executor = this.executors.get(task.type);
    if (!executor) {
      task.status = 'failed';
      task.error = `No executor registered for task type: ${task.type}`;
      task.completedAt = new Date();
      this.onTaskFailed?.(task);
      return;
    }

    // Create abort controller for cancellation
    const controller = new AbortController();
    this.runningTasks.set(task.id, controller);

    // Update task status
    task.status = 'running';
    task.startedAt = new Date();
    this.onTaskStarted?.(task);

    try {
      // Progress callback
      const onProgress = (progress: number, message?: string) => {
        task.progress = Math.max(0, Math.min(100, progress));
        task.onProgress?.(task.progress, message);
        this.onTaskProgress?.(task);
      };

      // Execute the task
      const result = await executor(task.data, onProgress, controller.signal);
      
      // Task completed successfully
      task.status = 'completed';
      task.progress = 100;
      task.result = result;
      task.completedAt = new Date();
      
      task.onComplete?.(result);
      this.onTaskCompleted?.(task);

    } catch (error) {
      if (controller.signal.aborted) {
        // Task was cancelled
        task.status = 'cancelled';
        this.onTaskCancelled?.(task);
      } else {
        // Task failed
        task.status = 'failed';
        task.error = error instanceof Error ? error.message : 'Unknown error';
        task.completedAt = new Date();
        
        task.onError?.(task.error);
        this.onTaskFailed?.(task);
      }
    } finally {
      // Clean up
      this.runningTasks.delete(task.id);
    }
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Stop processing (for cleanup)
   */
  stop(): void {
    this.isProcessing = false;
    
    // Cancel all running tasks
    for (const [taskId, controller] of this.runningTasks) {
      controller.abort();
      const task = this.tasks.get(taskId);
      if (task) {
        task.status = 'cancelled';
        task.completedAt = new Date();
      }
    }
    
    this.runningTasks.clear();
    this.taskQueue = [];
  }

  /**
   * Set maximum concurrent tasks
   */
  setMaxConcurrentTasks(max: number): void {
    this.maxConcurrentTasks = Math.max(1, max);
  }

  /**
   * Get maximum concurrent tasks
   */
  getMaxConcurrentTasks(): number {
    return this.maxConcurrentTasks;
  }
}