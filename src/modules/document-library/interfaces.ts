import { DocumentMetadata } from '../../types';

/**
 * Document Library interface for managing PDF document metadata and organization
 */
export interface DocumentLibrary {
  /**
   * Add a new document to the library
   * @param filePath Path to the PDF file
   * @param metadata Document metadata
   * @returns Promise that resolves when document is added
   */
  addDocument(filePath: string, metadata: DocumentMetadata): Promise<void>;

  /**
   * Remove a document from the library
   * @param documentId Unique identifier of the document
   * @returns Promise that resolves when document is removed
   */
  removeDocument(documentId: string): Promise<void>;

  /**
   * Update document metadata
   * @param documentId Unique identifier of the document
   * @param metadata Partial metadata to update
   * @returns Promise that resolves when document is updated
   */
  updateDocument(documentId: string, metadata: Partial<DocumentMetadata>): Promise<void>;

  /**
   * Get all documents in the library
   * @param sortBy Optional sort field (default: 'modifiedAt')
   * @param sortOrder Optional sort order (default: 'desc')
   * @returns Promise resolving to array of DocumentMetadata objects
   */
  getDocuments(
    sortBy?: keyof DocumentMetadata,
    sortOrder?: 'asc' | 'desc'
  ): Promise<DocumentMetadata[]>;

  /**
   * Get a specific document by ID
   * @param documentId Unique identifier of the document
   * @returns Promise resolving to DocumentMetadata object or null if not found
   */
  getDocument(documentId: string): Promise<DocumentMetadata | null>;

  /**
   * Search documents by filename or metadata
   * @param query Search query string
   * @param fields Optional array of fields to search in
   * @returns Promise resolving to array of matching DocumentMetadata objects
   */
  searchDocuments(
    query: string,
    fields?: Array<keyof DocumentMetadata>
  ): Promise<DocumentMetadata[]>;

  /**
   * Filter documents by criteria
   * @param criteria Filter criteria object
   * @returns Promise resolving to array of matching DocumentMetadata objects
   */
  filterDocuments(criteria: {
    fileSize?: { min?: number; max?: number };
    pageCount?: { min?: number; max?: number };
    createdAt?: { from?: Date; to?: Date };
    modifiedAt?: { from?: Date; to?: Date };
  }): Promise<DocumentMetadata[]>;

  /**
   * Get documents statistics
   * @returns Promise resolving to library statistics
   */
  getLibraryStats(): Promise<{
    totalDocuments: number;
    totalSize: number;
    totalPages: number;
    averageFileSize: number;
    averagePageCount: number;
  }>;

  /**
   * Import document metadata from file system scan
   * @param directoryPath Directory to scan for PDF files
   * @returns Promise resolving to number of documents imported
   */
  importFromDirectory(directoryPath: string): Promise<number>;

  /**
   * Export library metadata to JSON file
   * @param filePath Path where to save the export
   * @returns Promise that resolves when export is complete
   */
  exportLibrary(filePath: string): Promise<void>;

  /**
   * Import library metadata from JSON file
   * @param filePath Path to the import file
   * @param mergeStrategy Strategy for handling conflicts ('replace' | 'merge' | 'skip')
   * @returns Promise resolving to number of documents imported
   */
  importLibrary(
    filePath: string,
    mergeStrategy?: 'replace' | 'merge' | 'skip'
  ): Promise<number>;

  /**
   * Clear all documents from the library
   * @param deleteFiles Whether to also delete the actual PDF files
   * @returns Promise that resolves when library is cleared
   */
  clearLibrary(deleteFiles?: boolean): Promise<void>;

  /**
   * Validate library integrity and fix inconsistencies
   * @returns Promise resolving to validation report
   */
  validateLibrary(): Promise<{
    totalDocuments: number;
    validDocuments: number;
    invalidDocuments: number;
    missingFiles: string[];
    fixedIssues: number;
  }>;
}