import {
  DocumentMetadata,
  PageRange,
  TextEdit,
  Annotation,
  DrawingPath,
  FileMetadata,
  ImageData,
  PDFDocument,
} from './index';
import { ValidationError, ErrorFactory } from './errors';

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Validation utility class for all data models
 */
export class DataValidator {
  /**
   * Validate DocumentMetadata object
   */
  static validateDocumentMetadata(data: any): ValidationResult {
    const errors: ValidationError[] = [];

    if (!data || typeof data !== 'object') {
      errors.push(
        ErrorFactory.createValidationError(
          'invalid_input',
          'DocumentMetadata must be an object',
          'root',
          data
        )
      );
      return { isValid: false, errors };
    }

    // Validate required fields
    if (!data.id || typeof data.id !== 'string' || data.id.trim().length === 0) {
      errors.push(
        ErrorFactory.createValidationError(
          'missing_required_field',
          'Document ID is required and must be a non-empty string',
          'id',
          data.id
        )
      );
    }

    if (!data.fileName || typeof data.fileName !== 'string' || data.fileName.trim().length === 0) {
      errors.push(
        ErrorFactory.createValidationError(
          'missing_required_field',
          'File name is required and must be a non-empty string',
          'fileName',
          data.fileName
        )
      );
    }

    if (!data.filePath || typeof data.filePath !== 'string' || data.filePath.trim().length === 0) {
      errors.push(
        ErrorFactory.createValidationError(
          'missing_required_field',
          'File path is required and must be a non-empty string',
          'filePath',
          data.filePath
        )
      );
    }

    if (typeof data.fileSize !== 'number' || data.fileSize < 0) {
      errors.push(
        ErrorFactory.createValidationError(
          'invalid_format',
          'File size must be a non-negative number',
          'fileSize',
          data.fileSize
        )
      );
    }

    if (typeof data.pageCount !== 'number' || data.pageCount < 1) {
      errors.push(
        ErrorFactory.createValidationError(
          'invalid_format',
          'Page count must be a positive number',
          'pageCount',
          data.pageCount
        )
      );
    }

    if (!(data.createdAt instanceof Date) || isNaN(data.createdAt.getTime())) {
      errors.push(
        ErrorFactory.createValidationError(
          'invalid_format',
          'Created date must be a valid Date object',
          'createdAt',
          data.createdAt
        )
      );
    }

    if (!(data.modifiedAt instanceof Date) || isNaN(data.modifiedAt.getTime())) {
      errors.push(
        ErrorFactory.createValidationError(
          'invalid_format',
          'Modified date must be a valid Date object',
          'modifiedAt',
          data.modifiedAt
        )
      );
    }

    // Validate optional fields
    if (data.thumbnailPath !== undefined && 
        (typeof data.thumbnailPath !== 'string' || data.thumbnailPath.trim().length === 0)) {
      errors.push(
        ErrorFactory.createValidationError(
          'invalid_format',
          'Thumbnail path must be a non-empty string if provided',
          'thumbnailPath',
          data.thumbnailPath
        )
      );
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate PageRange object
   */
  static validatePageRange(data: any): ValidationResult {
    const errors: ValidationError[] = [];

    if (!data || typeof data !== 'object') {
      errors.push(
        ErrorFactory.createValidationError(
          'invalid_input',
          'PageRange must be an object',
          'root',
          data
        )
      );
      return { isValid: false, errors };
    }

    if (typeof data.startPage !== 'number' || data.startPage < 1) {
      errors.push(
        ErrorFactory.createValidationError(
          'invalid_format',
          'Start page must be a positive number',
          'startPage',
          data.startPage
        )
      );
    }

    if (typeof data.endPage !== 'number' || data.endPage < 1) {
      errors.push(
        ErrorFactory.createValidationError(
          'invalid_format',
          'End page must be a positive number',
          'endPage',
          data.endPage
        )
      );
    }

    if (typeof data.startPage === 'number' && typeof data.endPage === 'number' && 
        data.startPage > data.endPage) {
      errors.push(
        ErrorFactory.createValidationError(
          'out_of_range',
          'Start page cannot be greater than end page',
          'startPage',
          data.startPage
        )
      );
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate TextEdit object
   */
  static validateTextEdit(data: any): ValidationResult {
    const errors: ValidationError[] = [];

    if (!data || typeof data !== 'object') {
      errors.push(
        ErrorFactory.createValidationError(
          'invalid_input',
          'TextEdit must be an object',
          'root',
          data
        )
      );
      return { isValid: false, errors };
    }

    if (typeof data.pageNumber !== 'number' || data.pageNumber < 1) {
      errors.push(
        ErrorFactory.createValidationError(
          'invalid_format',
          'Page number must be a positive number',
          'pageNumber',
          data.pageNumber
        )
      );
    }

    if (typeof data.x !== 'number' || data.x < 0) {
      errors.push(
        ErrorFactory.createValidationError(
          'invalid_format',
          'X coordinate must be a non-negative number',
          'x',
          data.x
        )
      );
    }

    if (typeof data.y !== 'number' || data.y < 0) {
      errors.push(
        ErrorFactory.createValidationError(
          'invalid_format',
          'Y coordinate must be a non-negative number',
          'y',
          data.y
        )
      );
    }

    if (typeof data.width !== 'number' || data.width <= 0) {
      errors.push(
        ErrorFactory.createValidationError(
          'invalid_format',
          'Width must be a positive number',
          'width',
          data.width
        )
      );
    }

    if (typeof data.height !== 'number' || data.height <= 0) {
      errors.push(
        ErrorFactory.createValidationError(
          'invalid_format',
          'Height must be a positive number',
          'height',
          data.height
        )
      );
    }

    if (typeof data.newText !== 'string') {
      errors.push(
        ErrorFactory.createValidationError(
          'invalid_format',
          'New text must be a string',
          'newText',
          data.newText
        )
      );
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate DrawingPath object
   */
  static validateDrawingPath(data: any): ValidationResult {
    const errors: ValidationError[] = [];

    if (!data || typeof data !== 'object') {
      errors.push(
        ErrorFactory.createValidationError(
          'invalid_input',
          'DrawingPath must be an object',
          'root',
          data
        )
      );
      return { isValid: false, errors };
    }

    if (!Array.isArray(data.points) || data.points.length < 2) {
      errors.push(
        ErrorFactory.createValidationError(
          'invalid_format',
          'Points must be an array with at least 2 points',
          'points',
          data.points
        )
      );
    } else {
      data.points.forEach((point: any, index: number) => {
        if (!point || typeof point !== 'object' || 
            typeof point.x !== 'number' || typeof point.y !== 'number') {
          errors.push(
            ErrorFactory.createValidationError(
              'invalid_format',
              `Point at index ${index} must have numeric x and y coordinates`,
              `points[${index}]`,
              point
            )
          );
        }
      });
    }

    if (typeof data.strokeWidth !== 'number' || data.strokeWidth <= 0) {
      errors.push(
        ErrorFactory.createValidationError(
          'invalid_format',
          'Stroke width must be a positive number',
          'strokeWidth',
          data.strokeWidth
        )
      );
    }

    if (typeof data.strokeColor !== 'string' || !this.isValidColor(data.strokeColor)) {
      errors.push(
        ErrorFactory.createValidationError(
          'invalid_format',
          'Stroke color must be a valid color string',
          'strokeColor',
          data.strokeColor
        )
      );
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate Annotation object
   */
  static validateAnnotation(data: any): ValidationResult {
    const errors: ValidationError[] = [];

    if (!data || typeof data !== 'object') {
      errors.push(
        ErrorFactory.createValidationError(
          'invalid_input',
          'Annotation must be an object',
          'root',
          data
        )
      );
      return { isValid: false, errors };
    }

    const validTypes = ['text', 'highlight', 'drawing'];
    if (!validTypes.includes(data.type)) {
      errors.push(
        ErrorFactory.createValidationError(
          'invalid_format',
          `Annotation type must be one of: ${validTypes.join(', ')}`,
          'type',
          data.type
        )
      );
    }

    if (typeof data.pageNumber !== 'number' || data.pageNumber < 1) {
      errors.push(
        ErrorFactory.createValidationError(
          'invalid_format',
          'Page number must be a positive number',
          'pageNumber',
          data.pageNumber
        )
      );
    }

    if (typeof data.x !== 'number' || data.x < 0) {
      errors.push(
        ErrorFactory.createValidationError(
          'invalid_format',
          'X coordinate must be a non-negative number',
          'x',
          data.x
        )
      );
    }

    if (typeof data.y !== 'number' || data.y < 0) {
      errors.push(
        ErrorFactory.createValidationError(
          'invalid_format',
          'Y coordinate must be a non-negative number',
          'y',
          data.y
        )
      );
    }

    if (typeof data.width !== 'number' || data.width <= 0) {
      errors.push(
        ErrorFactory.createValidationError(
          'invalid_format',
          'Width must be a positive number',
          'width',
          data.width
        )
      );
    }

    if (typeof data.height !== 'number' || data.height <= 0) {
      errors.push(
        ErrorFactory.createValidationError(
          'invalid_format',
          'Height must be a positive number',
          'height',
          data.height
        )
      );
    }

    // Validate content based on annotation type
    if (data.type === 'drawing') {
      const drawingValidation = this.validateDrawingPath(data.content);
      if (!drawingValidation.isValid) {
        errors.push(...drawingValidation.errors);
      }
    } else if (typeof data.content !== 'string') {
      errors.push(
        ErrorFactory.createValidationError(
          'invalid_format',
          'Content must be a string for text and highlight annotations',
          'content',
          data.content
        )
      );
    }

    if (typeof data.color !== 'string' || !this.isValidColor(data.color)) {
      errors.push(
        ErrorFactory.createValidationError(
          'invalid_format',
          'Color must be a valid color string',
          'color',
          data.color
        )
      );
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate FileMetadata object
   */
  static validateFileMetadata(data: any): ValidationResult {
    const errors: ValidationError[] = [];

    if (!data || typeof data !== 'object') {
      errors.push(
        ErrorFactory.createValidationError(
          'invalid_input',
          'FileMetadata must be an object',
          'root',
          data
        )
      );
      return { isValid: false, errors };
    }

    if (!data.fileName || typeof data.fileName !== 'string') {
      errors.push(
        ErrorFactory.createValidationError(
          'missing_required_field',
          'File name is required and must be a string',
          'fileName',
          data.fileName
        )
      );
    }

    if (!data.filePath || typeof data.filePath !== 'string') {
      errors.push(
        ErrorFactory.createValidationError(
          'missing_required_field',
          'File path is required and must be a string',
          'filePath',
          data.filePath
        )
      );
    }

    if (typeof data.fileSize !== 'number' || data.fileSize < 0) {
      errors.push(
        ErrorFactory.createValidationError(
          'invalid_format',
          'File size must be a non-negative number',
          'fileSize',
          data.fileSize
        )
      );
    }

    if (!(data.createdAt instanceof Date) || isNaN(data.createdAt.getTime())) {
      errors.push(
        ErrorFactory.createValidationError(
          'invalid_format',
          'Created date must be a valid Date object',
          'createdAt',
          data.createdAt
        )
      );
    }

    if (!(data.modifiedAt instanceof Date) || isNaN(data.modifiedAt.getTime())) {
      errors.push(
        ErrorFactory.createValidationError(
          'invalid_format',
          'Modified date must be a valid Date object',
          'modifiedAt',
          data.modifiedAt
        )
      );
    }

    if (!data.mimeType || typeof data.mimeType !== 'string') {
      errors.push(
        ErrorFactory.createValidationError(
          'missing_required_field',
          'MIME type is required and must be a string',
          'mimeType',
          data.mimeType
        )
      );
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Helper method to validate color strings
   */
  private static isValidColor(color: string): boolean {
    // Basic validation for hex colors, rgb/rgba, and named colors
    const hexPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    const rgbPattern = /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/;
    const rgbaPattern = /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*(0|1|0?\.\d+)\s*\)$/;
    
    return hexPattern.test(color) || rgbPattern.test(color) || rgbaPattern.test(color);
  }

  /**
   * Validate file extension for PDF files
   */
  static validatePDFFileName(fileName: string): ValidationResult {
    const errors: ValidationError[] = [];

    if (!fileName || typeof fileName !== 'string') {
      errors.push(
        ErrorFactory.createValidationError(
          'invalid_input',
          'File name must be a non-empty string',
          'fileName',
          fileName
        )
      );
      return { isValid: false, errors };
    }

    const pdfExtensions = ['.pdf', '.PDF'];
    const hasValidExtension = pdfExtensions.some(ext => fileName.endsWith(ext));

    if (!hasValidExtension) {
      errors.push(
        ErrorFactory.createValidationError(
          'invalid_file_type',
          'File must have a .pdf extension',
          'fileName',
          fileName
        )
      );
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate page number against document page count
   */
  static validatePageNumber(pageNumber: number, totalPages: number): ValidationResult {
    const errors: ValidationError[] = [];

    if (typeof pageNumber !== 'number' || pageNumber < 1) {
      errors.push(
        ErrorFactory.createValidationError(
          'invalid_format',
          'Page number must be a positive number',
          'pageNumber',
          pageNumber
        )
      );
    }

    if (typeof totalPages === 'number' && pageNumber > totalPages) {
      errors.push(
        ErrorFactory.createValidationError(
          'out_of_range',
          `Page number ${pageNumber} exceeds total pages ${totalPages}`,
          'pageNumber',
          pageNumber
        )
      );
    }

    return { isValid: errors.length === 0, errors };
  }
}