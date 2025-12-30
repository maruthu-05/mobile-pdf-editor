// Document Library implementation using AsyncStorage for metadata management
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DocumentLibrary as IDocumentLibrary } from './interfaces';
import { DocumentMetadata } from '../../types';
import { ErrorFactory } from '../../types/errors';
import { DataValidator } from '../../types/validation';
import { FileManager } from '../file-manager';

export class DocumentLibrary implements IDocumentLibrary {
  private static instance: DocumentLibrary;
  private readonly storageKey = 'pdf_document_library';
  private readonly fileManager: FileManager;
  private documentsCache: Map<string, DocumentMetadata> = new Map();
  private cacheLoaded = false;

  private constructor(fileManager?: FileManager) {
    this.fileManager = fileManager || new FileManager();
  }

  /**
   * Get singleton instance of DocumentLibrary
   */
  static getInstance(fileManager?: FileManager): DocumentLibrary {
    if (!DocumentLibrary.instance) {
      DocumentLibrary.instance = new DocumentLibrary(fileManager);
    }
    return DocumentLibrary.instance;
  }

  /**
   * Initialize the document library
   */
  async initialize(): Promise<void> {
    await this.ensureCacheLoaded();
  }

  /**
   * Add a new document to the library
   */
  async addDocument(filePath: string, metadata: DocumentMetadata): Promise<void> {
    try {
      // Validate inputs
      if (!filePath || filePath.trim().length === 0) {
        const error = ErrorFactory.createValidationError(
          'invalid_input',
          'File path cannot be empty',
          'filePath',
          filePath
        );
        throw new Error(error.message);
      }

      // Validate metadata
      const validation = DataValidator.validateDocumentMetadata(metadata);
      if (!validation.isValid) {
        const error = ErrorFactory.createValidationError(
          'invalid_format',
          `Invalid document metadata: ${validation.errors.map(e => e.message).join(', ')}`,
          'metadata',
          metadata
        );
        throw new Error(error.message);
      }

      // Verify file exists
      const fileExists = await this.fileManager.fileExists(filePath);
      if (!fileExists) {
        const error = ErrorFactory.createValidationError(
          'invalid_input',
          `File not found: ${filePath}`,
          'filePath',
          filePath
        );
        throw new Error(error.message);
      }

      // Load cache if not already loaded
      await this.ensureCacheLoaded();

      // Check if document already exists
      if (this.documentsCache.has(metadata.id)) {
        const error = ErrorFactory.createValidationError(
          'duplicate_value',
          `Document with ID ${metadata.id} already exists`,
          'id',
          metadata.id
        );
        throw new Error(error.message);
      }

      // Add to cache
      this.documentsCache.set(metadata.id, { ...metadata });

      // Persist to storage
      await this.saveToStorage();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Remove a document from the library
   */
  async removeDocument(documentId: string): Promise<void> {
    try {
      if (!documentId || documentId.trim().length === 0) {
        const error = ErrorFactory.createValidationError(
          'invalid_input',
          'Document ID cannot be empty',
          'documentId',
          documentId
        );
        throw new Error(error.message);
      }

      // Load cache if not already loaded
      await this.ensureCacheLoaded();

      // Check if document exists
      if (!this.documentsCache.has(documentId)) {
        const error = ErrorFactory.createValidationError(
          'invalid_input',
          `Document with ID ${documentId} not found`,
          'documentId',
          documentId
        );
        throw new Error(error.message);
      }

      // Remove from cache
      this.documentsCache.delete(documentId);

      // Persist to storage
      await this.saveToStorage();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update document metadata
   */
  async updateDocument(documentId: string, metadata: Partial<DocumentMetadata>): Promise<void> {
    try {
      if (!documentId || documentId.trim().length === 0) {
        const error = ErrorFactory.createValidationError(
          'invalid_input',
          'Document ID cannot be empty',
          'documentId',
          documentId
        );
        throw new Error(error.message);
      }

      // Load cache if not already loaded
      await this.ensureCacheLoaded();

      // Check if document exists
      const existingDocument = this.documentsCache.get(documentId);
      if (!existingDocument) {
        const error = ErrorFactory.createValidationError(
          'invalid_input',
          `Document with ID ${documentId} not found`,
          'documentId',
          documentId
        );
        throw new Error(error.message);
      }

      // Merge metadata
      const updatedDocument = { ...existingDocument, ...metadata };

      // Validate updated metadata
      const validation = DataValidator.validateDocumentMetadata(updatedDocument);
      if (!validation.isValid) {
        const error = ErrorFactory.createValidationError(
          'invalid_format',
          `Invalid document metadata: ${validation.errors.map(e => e.message).join(', ')}`,
          'metadata',
          updatedDocument
        );
        throw new Error(error.message);
      }

      // Update cache
      this.documentsCache.set(documentId, updatedDocument);

      // Persist to storage
      await this.saveToStorage();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all documents in the library
   */
  async getDocuments(
    sortBy: keyof DocumentMetadata = 'modifiedAt',
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<DocumentMetadata[]> {
    try {
      // Load cache if not already loaded
      await this.ensureCacheLoaded();

      // Convert cache to array
      const documents = Array.from(this.documentsCache.values());

      // Sort documents
      documents.sort((a, b) => {
        const aValue = a[sortBy];
        const bValue = b[sortBy];

        let comparison = 0;
        if (aValue != null && bValue != null) {
          if (aValue < bValue) {
            comparison = -1;
          } else if (aValue > bValue) {
            comparison = 1;
          }
        } else if (aValue == null && bValue != null) {
          comparison = 1;
        } else if (aValue != null && bValue == null) {
          comparison = -1;
        }

        return sortOrder === 'desc' ? -comparison : comparison;
      });

      return documents;
    } catch (error) {
      throw ErrorFactory.createValidationError(
        'invalid_input',
        `Failed to get documents: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'getDocuments',
        error
      );
    }
  }

  /**
   * Get a specific document by ID
   */
  async getDocument(documentId: string): Promise<DocumentMetadata | null> {
    try {
      if (!documentId || documentId.trim().length === 0) {
        return null;
      }

      // Load cache if not already loaded
      await this.ensureCacheLoaded();

      return this.documentsCache.get(documentId) || null;
    } catch (error) {
      throw ErrorFactory.createValidationError(
        'invalid_input',
        `Failed to get document: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'documentId',
        documentId
      );
    }
  }

  /**
   * Search documents by filename or metadata
   */
  async searchDocuments(
    query: string,
    fields: Array<keyof DocumentMetadata> = ['fileName']
  ): Promise<DocumentMetadata[]> {
    try {
      if (!query || query.trim().length === 0) {
        return [];
      }

      // Load cache if not already loaded
      await this.ensureCacheLoaded();

      const searchQuery = query.toLowerCase().trim();
      const results: DocumentMetadata[] = [];

      for (const document of this.documentsCache.values()) {
        let matches = false;

        for (const field of fields) {
          const fieldValue = document[field];
          if (typeof fieldValue === 'string' && fieldValue.toLowerCase().includes(searchQuery)) {
            matches = true;
            break;
          }
        }

        if (matches) {
          results.push(document);
        }
      }

      // Sort by relevance (exact matches first, then partial matches)
      results.sort((a, b) => {
        // Check for exact matches in filename (without extension)
        const aFileNameWithoutExt = a.fileName.toLowerCase().replace(/\.[^/.]+$/, '');
        const bFileNameWithoutExt = b.fileName.toLowerCase().replace(/\.[^/.]+$/, '');
        
        const aExact = aFileNameWithoutExt === searchQuery;
        const bExact = bFileNameWithoutExt === searchQuery;
        
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        // If both or neither are exact matches, sort by modification date (newest first)
        return b.modifiedAt.getTime() - a.modifiedAt.getTime();
      });

      return results;
    } catch (error) {
      throw ErrorFactory.createValidationError(
        'invalid_input',
        `Failed to search documents: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'query',
        query
      );
    }
  }

  /**
   * Filter documents by criteria
   */
  async filterDocuments(criteria: {
    fileSize?: { min?: number; max?: number };
    pageCount?: { min?: number; max?: number };
    createdAt?: { from?: Date; to?: Date };
    modifiedAt?: { from?: Date; to?: Date };
  }): Promise<DocumentMetadata[]> {
    try {
      // Load cache if not already loaded
      await this.ensureCacheLoaded();

      const results: DocumentMetadata[] = [];

      for (const document of this.documentsCache.values()) {
        let matches = true;

        // Filter by file size
        if (criteria.fileSize) {
          if (criteria.fileSize.min !== undefined && document.fileSize < criteria.fileSize.min) {
            matches = false;
          }
          if (criteria.fileSize.max !== undefined && document.fileSize > criteria.fileSize.max) {
            matches = false;
          }
        }

        // Filter by page count
        if (criteria.pageCount) {
          if (criteria.pageCount.min !== undefined && document.pageCount < criteria.pageCount.min) {
            matches = false;
          }
          if (criteria.pageCount.max !== undefined && document.pageCount > criteria.pageCount.max) {
            matches = false;
          }
        }

        // Filter by created date
        if (criteria.createdAt) {
          if (criteria.createdAt.from && document.createdAt < criteria.createdAt.from) {
            matches = false;
          }
          if (criteria.createdAt.to && document.createdAt > criteria.createdAt.to) {
            matches = false;
          }
        }

        // Filter by modified date
        if (criteria.modifiedAt) {
          if (criteria.modifiedAt.from && document.modifiedAt < criteria.modifiedAt.from) {
            matches = false;
          }
          if (criteria.modifiedAt.to && document.modifiedAt > criteria.modifiedAt.to) {
            matches = false;
          }
        }

        if (matches) {
          results.push(document);
        }
      }

      return results;
    } catch (error) {
      throw ErrorFactory.createValidationError(
        'invalid_input',
        `Failed to filter documents: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'criteria',
        criteria
      );
    }
  }

  /**
   * Get documents statistics
   */
  async getLibraryStats(): Promise<{
    totalDocuments: number;
    totalSize: number;
    totalPages: number;
    averageFileSize: number;
    averagePageCount: number;
  }> {
    try {
      // Load cache if not already loaded
      await this.ensureCacheLoaded();

      const documents = Array.from(this.documentsCache.values());
      const totalDocuments = documents.length;

      if (totalDocuments === 0) {
        return {
          totalDocuments: 0,
          totalSize: 0,
          totalPages: 0,
          averageFileSize: 0,
          averagePageCount: 0,
        };
      }

      const totalSize = documents.reduce((sum, doc) => sum + doc.fileSize, 0);
      const totalPages = documents.reduce((sum, doc) => sum + doc.pageCount, 0);

      return {
        totalDocuments,
        totalSize,
        totalPages,
        averageFileSize: Math.round(totalSize / totalDocuments),
        averagePageCount: Math.round(totalPages / totalDocuments),
      };
    } catch (error) {
      throw ErrorFactory.createValidationError(
        'invalid_input',
        `Failed to get library stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'getLibraryStats',
        error
      );
    }
  }

  /**
   * Import document metadata from file system scan
   */
  async importFromDirectory(directoryPath: string): Promise<number> {
    try {
      if (!directoryPath || directoryPath.trim().length === 0) {
        throw ErrorFactory.createValidationError(
          'invalid_input',
          'Directory path cannot be empty',
          'directoryPath',
          directoryPath
        );
      }

      // Get all PDF files from directory
      const files = await this.fileManager.listFiles(directoryPath, '.pdf');
      let importedCount = 0;

      for (const file of files) {
        try {
          // Generate document metadata from file
          const documentId = this.generateDocumentId(file.filePath);
          
          // Check if document already exists
          const existingDocument = await this.getDocument(documentId);
          if (existingDocument) {
            continue; // Skip existing documents
          }

          const metadata: DocumentMetadata = {
            id: documentId,
            fileName: file.fileName,
            filePath: file.filePath,
            fileSize: file.fileSize,
            pageCount: 1, // Default, would need PDF parsing to get actual count
            createdAt: file.createdAt,
            modifiedAt: file.modifiedAt,
          };

          await this.addDocument(file.filePath, metadata);
          importedCount++;
        } catch (error) {
          // Skip files that can't be imported
          console.warn(`Failed to import file: ${file.filePath}`, error);
        }
      }

      return importedCount;
    } catch (error) {
      throw ErrorFactory.createValidationError(
        'invalid_input',
        `Failed to import from directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'directoryPath',
        directoryPath
      );
    }
  }

  /**
   * Export library metadata to JSON file
   */
  async exportLibrary(filePath: string): Promise<void> {
    try {
      if (!filePath || filePath.trim().length === 0) {
        throw ErrorFactory.createValidationError(
          'invalid_input',
          'File path cannot be empty',
          'filePath',
          filePath
        );
      }

      // Load cache if not already loaded
      await this.ensureCacheLoaded();

      const documents = Array.from(this.documentsCache.values());
      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        documents,
      };

      const jsonData = JSON.stringify(exportData, null, 2);
      const buffer = Buffer.from(jsonData, 'utf8');

      await this.fileManager.saveFile(buffer, filePath);
    } catch (error) {
      throw ErrorFactory.createValidationError(
        'invalid_input',
        `Failed to export library: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'filePath',
        filePath
      );
    }
  }

  /**
   * Import library metadata from JSON file
   */
  async importLibrary(
    filePath: string,
    mergeStrategy: 'replace' | 'merge' | 'skip' = 'merge'
  ): Promise<number> {
    try {
      if (!filePath || filePath.trim().length === 0) {
        throw ErrorFactory.createValidationError(
          'invalid_input',
          'File path cannot be empty',
          'filePath',
          filePath
        );
      }

      // Read import file
      const jsonData = await this.fileManager.readFileAsText(filePath);
      const importData = JSON.parse(jsonData);

      if (!importData.documents || !Array.isArray(importData.documents)) {
        throw ErrorFactory.createValidationError(
          'invalid_format',
          'Invalid import file format',
          'filePath',
          filePath
        );
      }

      // Load cache if not already loaded
      await this.ensureCacheLoaded();

      let importedCount = 0;

      for (const docData of importData.documents) {
        try {
          // Convert date strings back to Date objects
          const metadata: DocumentMetadata = {
            ...docData,
            createdAt: new Date(docData.createdAt),
            modifiedAt: new Date(docData.modifiedAt),
          };

          // Validate metadata
          const validation = DataValidator.validateDocumentMetadata(metadata);
          if (!validation.isValid) {
            console.warn(`Skipping invalid document: ${metadata.id}`, validation.errors);
            continue;
          }

          const existingDocument = this.documentsCache.get(metadata.id);

          if (existingDocument) {
            switch (mergeStrategy) {
              case 'replace':
                this.documentsCache.set(metadata.id, metadata);
                importedCount++;
                break;
              case 'merge':
                const mergedMetadata = { ...existingDocument, ...metadata };
                this.documentsCache.set(metadata.id, mergedMetadata);
                importedCount++;
                break;
              case 'skip':
                // Skip existing documents
                break;
            }
          } else {
            this.documentsCache.set(metadata.id, metadata);
            importedCount++;
          }
        } catch (error) {
          console.warn(`Failed to import document: ${docData.id}`, error);
        }
      }

      // Persist to storage
      await this.saveToStorage();

      return importedCount;
    } catch (error) {
      throw ErrorFactory.createValidationError(
        'invalid_input',
        `Failed to import library: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'filePath',
        filePath
      );
    }
  }

  /**
   * Clear all documents from the library
   */
  async clearLibrary(deleteFiles: boolean = false): Promise<void> {
    try {
      // Load cache if not already loaded
      await this.ensureCacheLoaded();

      if (deleteFiles) {
        // Delete actual PDF files
        for (const document of this.documentsCache.values()) {
          try {
            await this.fileManager.deleteFile(document.filePath);
          } catch (error) {
            console.warn(`Failed to delete file: ${document.filePath}`, error);
          }
        }
      }

      // Clear cache
      this.documentsCache.clear();

      // Clear storage
      await AsyncStorage.removeItem(this.storageKey);
    } catch (error) {
      throw ErrorFactory.createValidationError(
        'invalid_input',
        `Failed to clear library: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'clearLibrary',
        error
      );
    }
  }

  /**
   * Validate library integrity and fix inconsistencies
   */
  async validateLibrary(): Promise<{
    totalDocuments: number;
    validDocuments: number;
    invalidDocuments: number;
    missingFiles: string[];
    fixedIssues: number;
  }> {
    try {
      // Load cache if not already loaded
      await this.ensureCacheLoaded();

      const documents = Array.from(this.documentsCache.values());
      const totalDocuments = documents.length;
      let validDocuments = 0;
      let invalidDocuments = 0;
      const missingFiles: string[] = [];
      let fixedIssues = 0;

      for (const document of documents) {
        let isValid = true;

        // Validate metadata structure
        const validation = DataValidator.validateDocumentMetadata(document);
        if (!validation.isValid) {
          isValid = false;
          invalidDocuments++;
        }

        // Check if file exists
        const fileExists = await this.fileManager.fileExists(document.filePath);
        if (!fileExists) {
          isValid = false;
          missingFiles.push(document.filePath);
        }

        if (isValid) {
          validDocuments++;
        }
      }

      // Remove documents with missing files
      for (const missingFile of missingFiles) {
        const documentsToRemove = documents.filter(doc => doc.filePath === missingFile);
        for (const doc of documentsToRemove) {
          this.documentsCache.delete(doc.id);
          fixedIssues++;
        }
      }

      // Save changes if any fixes were made
      if (fixedIssues > 0) {
        await this.saveToStorage();
      }

      return {
        totalDocuments,
        validDocuments,
        invalidDocuments,
        missingFiles,
        fixedIssues,
      };
    } catch (error) {
      throw ErrorFactory.createValidationError(
        'invalid_input',
        `Failed to validate library: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'validateLibrary',
        error
      );
    }
  }

  /**
   * Private helper methods
   */

  /**
   * Ensure cache is loaded from storage
   */
  private async ensureCacheLoaded(): Promise<void> {
    if (this.cacheLoaded) {
      return;
    }

    try {
      const storedData = await AsyncStorage.getItem(this.storageKey);
      if (storedData) {
        const documents: DocumentMetadata[] = JSON.parse(storedData);
        
        // Convert date strings back to Date objects and populate cache
        for (const doc of documents) {
          const metadata: DocumentMetadata = {
            ...doc,
            createdAt: new Date(doc.createdAt),
            modifiedAt: new Date(doc.modifiedAt),
          };
          this.documentsCache.set(metadata.id, metadata);
        }
      }
      
      this.cacheLoaded = true;
    } catch (error) {
      console.warn('Failed to load documents from storage:', error);
      this.cacheLoaded = true; // Mark as loaded even if failed to prevent infinite loops
    }
  }

  /**
   * Save cache to storage
   */
  private async saveToStorage(): Promise<void> {
    try {
      const documents = Array.from(this.documentsCache.values());
      const jsonData = JSON.stringify(documents);
      await AsyncStorage.setItem(this.storageKey, jsonData);
    } catch (error) {
      throw ErrorFactory.createValidationError(
        'invalid_input',
        `Failed to save to storage: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'saveToStorage',
        error
      );
    }
  }

  /**
   * Generate a unique document ID from file path
   */
  private generateDocumentId(filePath: string): string {
    // Create a simple hash-like ID from file path and timestamp
    const hash = filePath.split('').reduce((acc, char) => {
      return ((acc << 5) - acc + char.charCodeAt(0)) & 0xffffffff;
    }, 0);
    
    return `doc_${Math.abs(hash)}_${Date.now()}`;
  }
}