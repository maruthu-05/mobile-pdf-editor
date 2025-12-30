import { router } from 'expo-router';
import { DocumentMetadata } from '../types';

/**
 * Navigation utilities for the PDF Editor app
 */

export interface NavigationParams {
  documentId?: string;
  [key: string]: any;
}

/**
 * Validates navigation parameters
 */
export const validateNavigationParams = (params: NavigationParams, requiredParams: string[]): boolean => {
  for (const param of requiredParams) {
    if (!params[param] || typeof params[param] !== 'string' || params[param].trim() === '') {
      return false;
    }
  }
  return true;
};

/**
 * Navigation functions with parameter validation
 */
export const navigation = {
  /**
   * Navigate to document library (home)
   */
  toDocumentLibrary: () => {
    router.push('/');
  },

  /**
   * Navigate to PDF viewer with document ID
   */
  toPDFViewer: (documentId: string) => {
    if (!documentId || typeof documentId !== 'string' || documentId.trim() === '') {
      throw new Error('Invalid document ID provided');
    }
    router.push(`/pdf-viewer/${encodeURIComponent(documentId)}`);
  },

  /**
   * Navigate to merge screen
   */
  toMerge: () => {
    router.push('/merge');
  },

  /**
   * Navigate to split screen with document ID
   */
  toSplit: (documentId: string) => {
    if (!documentId || typeof documentId !== 'string' || documentId.trim() === '') {
      throw new Error('Invalid document ID provided');
    }
    router.push(`/split/${encodeURIComponent(documentId)}`);
  },

  /**
   * Navigate back
   */
  back: () => {
    router.back();
  },

  /**
   * Replace current route
   */
  replace: (href: string) => {
    router.replace(href);
  },

  /**
   * Check if we can go back
   */
  canGoBack: () => {
    return router.canGoBack();
  },
};

/**
 * Deep linking utilities
 */
export const deepLinking = {
  /**
   * Generate deep link URL for document viewer
   */
  generateDocumentViewerLink: (documentId: string): string => {
    if (!documentId || typeof documentId !== 'string' || documentId.trim() === '') {
      throw new Error('Invalid document ID provided');
    }
    return `mobilepdfeditor://pdf-viewer/${encodeURIComponent(documentId)}`;
  },

  /**
   * Generate deep link URL for split screen
   */
  generateSplitLink: (documentId: string): string => {
    if (!documentId || typeof documentId !== 'string' || documentId.trim() === '') {
      throw new Error('Invalid document ID provided');
    }
    return `mobilepdfeditor://split/${encodeURIComponent(documentId)}`;
  },

  /**
   * Generate deep link URL for merge screen
   */
  generateMergeLink: (): string => {
    return 'mobilepdfeditor://merge';
  },

  /**
   * Parse deep link URL and extract parameters
   */
  parseDeepLink: (url: string): { route: string; params: Record<string, string> } | null => {
    try {
      const urlObj = new URL(url);
      
      if (urlObj.protocol !== 'mobilepdfeditor:') {
        return null;
      }

      let pathSegments = urlObj.pathname.split('/').filter(segment => segment.length > 0);
      
      // Handle the case where hostname is part of the path (mobilepdfeditor://pdf-viewer/doc123)
      if (urlObj.hostname && urlObj.hostname !== '') {
        pathSegments = [urlObj.hostname, ...pathSegments];
      }

      if (pathSegments.length === 0) {
        return { route: '/', params: {} };
      }

      const route = `/${pathSegments.join('/')}`;
      const params: Record<string, string> = {};

      // Extract query parameters
      urlObj.searchParams.forEach((value, key) => {
        params[key] = decodeURIComponent(value);
      });

      return { route, params };
    } catch (error) {
      console.error('Failed to parse deep link:', error);
      return null;
    }
  },
};

/**
 * Navigation guards
 */
export const navigationGuards = {
  /**
   * Guard for document-specific routes
   */
  requireDocument: async (documentId: string): Promise<DocumentMetadata | null> => {
    try {
      if (!documentId || typeof documentId !== 'string' || documentId.trim() === '') {
        throw new Error('Document ID is required');
      }

      // Import DocumentLibrary dynamically to avoid circular dependencies
      const { DocumentLibrary } = await import('../modules/document-library');
      const documentLibrary = new DocumentLibrary();
      
      const documents = await documentLibrary.getDocuments();
      const document = documents.find(doc => doc.id === documentId);

      if (!document) {
        throw new Error('Document not found');
      }

      return document;
    } catch (error) {
      console.error('Navigation guard failed:', error);
      return null;
    }
  },

  /**
   * Guard for checking if documents exist for merge operation
   */
  requireMultipleDocuments: async (): Promise<boolean> => {
    try {
      // Import DocumentLibrary dynamically to avoid circular dependencies
      const { DocumentLibrary } = await import('../modules/document-library');
      const documentLibrary = new DocumentLibrary();
      
      const documents = await documentLibrary.getDocuments();
      return documents.length >= 2;
    } catch (error) {
      console.error('Navigation guard failed:', error);
      return false;
    }
  },
};

/**
 * Route parameter validation schemas
 */
export const routeValidation = {
  pdfViewer: {
    requiredParams: ['documentId'],
    validate: (params: NavigationParams) => validateNavigationParams(params, ['documentId']),
  },
  split: {
    requiredParams: ['documentId'],
    validate: (params: NavigationParams) => validateNavigationParams(params, ['documentId']),
  },
  merge: {
    requiredParams: [],
    validate: () => true,
  },
};