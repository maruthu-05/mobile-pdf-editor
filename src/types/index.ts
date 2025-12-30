// Core data models and interfaces for the mobile PDF editor

// Re-export error types and validation utilities
export * from './errors';
export * from './validation';

/**
 * Document metadata interface for managing PDF documents in the library
 */
export interface DocumentMetadata {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  pageCount: number;
  createdAt: Date;
  modifiedAt: Date;
  thumbnailPath?: string;
}

/**
 * Page range interface for PDF split operations
 */
export interface PageRange {
  startPage: number;
  endPage: number;
}

/**
 * Text edit interface for PDF text editing operations
 */
export interface TextEdit {
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  newText: string;
}

/**
 * Drawing path interface for annotation drawings
 */
export interface DrawingPath {
  points: Array<{ x: number; y: number }>;
  strokeWidth: number;
  strokeColor: string;
}

/**
 * Annotation interface for PDF annotations
 */
export interface Annotation {
  type: 'text' | 'highlight' | 'drawing';
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string | DrawingPath;
  color: string;
}

/**
 * File metadata interface for file system operations
 */
export interface FileMetadata {
  fileName: string;
  filePath: string;
  fileSize: number;
  createdAt: Date;
  modifiedAt: Date;
  mimeType: string;
}

/**
 * Image data interface for rendered PDF pages
 */
export interface ImageData {
  uri: string;
  width: number;
  height: number;
}

/**
 * PDF document interface for loaded PDF documents
 */
export interface PDFDocument {
  filePath: string;
  pageCount: number;
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    producer?: string;
    creationDate?: Date;
    modificationDate?: Date;
  };
}