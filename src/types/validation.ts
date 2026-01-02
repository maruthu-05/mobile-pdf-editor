// Data validation utilities for the PDF editor app
import { DocumentMetadata, FileMetadata } from './index';

export interface ValidationResult {
  isValid: boolean;
  errors: Array<{
    field: string;
    message: string;
    value?: any;
  }>;
}

export class DataValidator {
  static validateDocumentMetadata(metadata: DocumentMetadata): ValidationResult {
    const errors: Array<{ field: string; message: string; value?: any }> = [];

    // Validate required fields
    if (!metadata.id || typeof metadata.id !== 'string' || metadata.id.trim().length === 0) {
      errors.push({
        field: 'id',
        message: 'Document ID is required and must be a non-empty string',
        value: metadata.id,
      });
    }

    if (!metadata.fileName || typeof metadata.fileName !== 'string' || metadata.fileName.trim().length === 0) {
      errors.push({
        field: 'fileName',
        message: 'File name is required and must be a non-empty string',
        value: metadata.fileName,
      });
    }

    if (!metadata.filePath || typeof metadata.filePath !== 'string' || metadata.filePath.trim().length === 0) {
      errors.push({
        field: 'filePath',
        message: 'File path is required and must be a non-empty string',
        value: metadata.filePath,
      });
    }

    // Validate numeric fields
    if (typeof metadata.fileSize !== 'number' || metadata.fileSize < 0) {
      errors.push({
        field: 'fileSize',
        message: 'File size must be a non-negative number',
        value: metadata.fileSize,
      });
    }

    if (typeof metadata.pageCount !== 'number' || metadata.pageCount < 1) {
      errors.push({
        field: 'pageCount',
        message: 'Page count must be a positive number',
        value: metadata.pageCount,
      });
    }

    // Validate date fields
    if (!(metadata.createdAt instanceof Date) || isNaN(metadata.createdAt.getTime())) {
      errors.push({
        field: 'createdAt',
        message: 'Created date must be a valid Date object',
        value: metadata.createdAt,
      });
    }

    if (!(metadata.modifiedAt instanceof Date) || isNaN(metadata.modifiedAt.getTime())) {
      errors.push({
        field: 'modifiedAt',
        message: 'Modified date must be a valid Date object',
        value: metadata.modifiedAt,
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateFileMetadata(metadata: FileMetadata): ValidationResult {
    const errors: Array<{ field: string; message: string; value?: any }> = [];

    // Validate required fields
    if (!metadata.fileName || typeof metadata.fileName !== 'string' || metadata.fileName.trim().length === 0) {
      errors.push({
        field: 'fileName',
        message: 'File name is required and must be a non-empty string',
        value: metadata.fileName,
      });
    }

    if (!metadata.filePath || typeof metadata.filePath !== 'string' || metadata.filePath.trim().length === 0) {
      errors.push({
        field: 'filePath',
        message: 'File path is required and must be a non-empty string',
        value: metadata.filePath,
      });
    }

    // Validate numeric fields
    if (typeof metadata.fileSize !== 'number' || metadata.fileSize < 0) {
      errors.push({
        field: 'fileSize',
        message: 'File size must be a non-negative number',
        value: metadata.fileSize,
      });
    }

    // Validate date fields
    if (!(metadata.createdAt instanceof Date) || isNaN(metadata.createdAt.getTime())) {
      errors.push({
        field: 'createdAt',
        message: 'Created date must be a valid Date object',
        value: metadata.createdAt,
      });
    }

    if (!(metadata.modifiedAt instanceof Date) || isNaN(metadata.modifiedAt.getTime())) {
      errors.push({
        field: 'modifiedAt',
        message: 'Modified date must be a valid Date object',
        value: metadata.modifiedAt,
      });
    }

    // Validate MIME type
    if (!metadata.mimeType || typeof metadata.mimeType !== 'string') {
      errors.push({
        field: 'mimeType',
        message: 'MIME type is required and must be a string',
        value: metadata.mimeType,
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}