import { InteractionManager, PixelRatio } from 'react-native';

export interface PerformanceMetrics {
  memoryUsage: number;
  renderTime: number;
  interactionTime: number;
  frameDrops: number;
}

export interface MemoryInfo {
  used: number;
  total: number;
  available: number;
  percentage: number;
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetrics[] = [];
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timeout;

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  startMonitoring(intervalMs: number = 5000): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);

    console.log('Performance monitoring started');
  }

  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    console.log('Performance monitoring stopped');
  }

  private collectMetrics(): void {
    const startTime = performance.now();

    // Simulate memory usage calculation (in a real app, you'd use native modules)
    const memoryUsage = this.estimateMemoryUsage();

    // Measure interaction responsiveness
    InteractionManager.runAfterInteractions(() => {
      const interactionTime = performance.now() - startTime;
      
      const metrics: PerformanceMetrics = {
        memoryUsage,
        renderTime: this.measureRenderTime(),
        interactionTime,
        frameDrops: this.estimateFrameDrops(),
      };

      this.metrics.push(metrics);
      
      // Keep only last 100 measurements
      if (this.metrics.length > 100) {
        this.metrics.shift();
      }

      this.checkPerformanceThresholds(metrics);
    });
  }

  private estimateMemoryUsage(): number {
    // In a real implementation, you would use native modules to get actual memory usage
    // For now, we'll simulate based on app state and operations
    const baseMemory = 50; // Base app memory in MB
    const variableMemory = Math.random() * 30; // Variable usage
    return baseMemory + variableMemory;
  }

  private measureRenderTime(): number {
    // Simulate render time measurement
    return Math.random() * 16; // Target is 16ms for 60fps
  }

  private estimateFrameDrops(): number {
    // Simulate frame drop detection
    return Math.floor(Math.random() * 3);
  }

  private checkPerformanceThresholds(metrics: PerformanceMetrics): void {
    const warnings: string[] = [];

    if (metrics.memoryUsage > 100) {
      warnings.push(`High memory usage: ${metrics.memoryUsage.toFixed(1)}MB`);
    }

    if (metrics.renderTime > 16) {
      warnings.push(`Slow render time: ${metrics.renderTime.toFixed(1)}ms`);
    }

    if (metrics.interactionTime > 100) {
      warnings.push(`Slow interaction response: ${metrics.interactionTime.toFixed(1)}ms`);
    }

    if (metrics.frameDrops > 2) {
      warnings.push(`Frame drops detected: ${metrics.frameDrops}`);
    }

    if (warnings.length > 0) {
      console.warn('Performance issues detected:', warnings);
    }
  }

  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  getAverageMetrics(): PerformanceMetrics | null {
    if (this.metrics.length === 0) return null;

    const sum = this.metrics.reduce(
      (acc, metric) => ({
        memoryUsage: acc.memoryUsage + metric.memoryUsage,
        renderTime: acc.renderTime + metric.renderTime,
        interactionTime: acc.interactionTime + metric.interactionTime,
        frameDrops: acc.frameDrops + metric.frameDrops,
      }),
      { memoryUsage: 0, renderTime: 0, interactionTime: 0, frameDrops: 0 }
    );

    const count = this.metrics.length;
    return {
      memoryUsage: sum.memoryUsage / count,
      renderTime: sum.renderTime / count,
      interactionTime: sum.interactionTime / count,
      frameDrops: sum.frameDrops / count,
    };
  }

  clearMetrics(): void {
    this.metrics = [];
  }

  // Memory leak detection
  detectMemoryLeaks(): boolean {
    if (this.metrics.length < 10) return false;

    const recent = this.metrics.slice(-10);
    const older = this.metrics.slice(-20, -10);

    if (older.length === 0) return false;

    const recentAvg = recent.reduce((sum, m) => sum + m.memoryUsage, 0) / recent.length;
    const olderAvg = older.reduce((sum, m) => sum + m.memoryUsage, 0) / older.length;

    // Consider it a leak if memory increased by more than 20MB consistently
    return recentAvg - olderAvg > 20;
  }

  // Performance optimization suggestions
  getOptimizationSuggestions(): string[] {
    const suggestions: string[] = [];
    const avgMetrics = this.getAverageMetrics();

    if (!avgMetrics) return suggestions;

    if (avgMetrics.memoryUsage > 80) {
      suggestions.push('Consider implementing image caching with size limits');
      suggestions.push('Review PDF page rendering - implement lazy loading');
      suggestions.push('Clear unused document references');
    }

    if (avgMetrics.renderTime > 12) {
      suggestions.push('Optimize component re-renders with React.memo');
      suggestions.push('Consider virtualizing long lists');
      suggestions.push('Reduce complex calculations in render methods');
    }

    if (avgMetrics.interactionTime > 50) {
      suggestions.push('Move heavy operations to background threads');
      suggestions.push('Implement debouncing for frequent user interactions');
      suggestions.push('Consider using InteractionManager for non-critical updates');
    }

    if (avgMetrics.frameDrops > 1) {
      suggestions.push('Reduce animation complexity');
      suggestions.push('Use native driver for animations when possible');
      suggestions.push('Optimize image loading and processing');
    }

    return suggestions;
  }

  // Device performance assessment
  assessDevicePerformance(): 'high' | 'medium' | 'low' {
    const pixelRatio = PixelRatio.get();
    const screenScale = PixelRatio.getFontScale();
    
    // Simple heuristic based on device capabilities
    if (pixelRatio >= 3 && screenScale <= 1.2) {
      return 'high';
    } else if (pixelRatio >= 2) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  // Generate performance report
  generateReport(): {
    summary: PerformanceMetrics | null;
    devicePerformance: 'high' | 'medium' | 'low';
    memoryLeakDetected: boolean;
    suggestions: string[];
    metricsCount: number;
  } {
    return {
      summary: this.getAverageMetrics(),
      devicePerformance: this.assessDevicePerformance(),
      memoryLeakDetected: this.detectMemoryLeaks(),
      suggestions: this.getOptimizationSuggestions(),
      metricsCount: this.metrics.length,
    };
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance();