# Core Data Models and Interfaces

This directory contains the core TypeScript interfaces, data models, and validation functions for the mobile PDF editor application.

## Files Overview

### `index.ts`
Main export file containing all core data model interfaces:
- `DocumentMetadata` - Metadata for PDF documents in the library
- `PageRange` - Page range specification for PDF operations
- `TextEdit` - Text editing operations on PDF content
- `Annotation` - PDF annotations (text, highlight, drawing)
- `DrawingPath` - Drawing path data for annotation drawings
- `FileMetadata` - File system metadata
- `ImageData` - Rendered page image data
- `PDFDocument` - Loaded PDF document information

### `errors.ts`
Comprehensive error handling system:
- `BaseError` - Base interface for all application errors
- `FileSystemError` - File system operation errors
- `PDFError` - PDF processing errors
- `ValidationError` - Data validation errors
- `NetworkError` - Network operation errors (future use)
- `ErrorFactory` - Factory class for creating typed errors
- `ErrorHandler` - Interface for error handling

### `validation.ts`
Data validation utilities:
- `ValidationResult` - Validation result interface
- `DataValidator` - Static class with validation methods for all data models
- Comprehensive validation for all interfaces
- Helper methods for common validation patterns

## Module Interfaces

### PDF Engine (`/modules/pdf-engine/interfaces.ts`)
Interface for PDF manipulation operations:
- `loadPDF()` - Load PDF documents
- `mergePDFs()` - Merge multiple PDFs
- `splitPDF()` - Split PDFs by page ranges
- `editPDFText()` - Edit text content
- `addAnnotations()` - Add annotations
- `renderPage()` - Render pages as images
- Additional utility methods

### File Manager (`/modules/file-manager/interfaces.ts`)
Interface for local file system operations:
- `saveFile()` - Save files to local storage
- `deleteFile()` - Delete files
- `listFiles()` - List directory contents
- `getFileInfo()` - Get file metadata
- `renameFile()` - Rename files
- Storage management methods

### Document Library (`/modules/document-library/interfaces.ts`)
Interface for document metadata management:
- `addDocument()` - Add documents to library
- `removeDocument()` - Remove documents
- `updateDocument()` - Update document metadata
- `getDocuments()` - Retrieve documents with sorting
- `searchDocuments()` - Search functionality
- Library management and statistics

## Validation Features

The validation system provides:
- Type-safe validation for all data models
- Detailed error reporting with specific error categories
- Field-level validation with context
- Helper methods for common validation patterns
- Comprehensive error messages for debugging

## Usage Example

```typescript
import { DataValidator, DocumentMetadata } from '../types';

const metadata: DocumentMetadata = {
  id: 'doc-123',
  fileName: 'document.pdf',
  filePath: '/path/to/document.pdf',
  fileSize: 1024,
  pageCount: 10,
  createdAt: new Date(),
  modifiedAt: new Date(),
};

const result = DataValidator.validateDocumentMetadata(metadata);
if (!result.isValid) {
  console.error('Validation errors:', result.errors);
}
```

## Requirements Covered

This implementation addresses the following requirements:
- **1.3**: PDF file validation and metadata management
- **1.4**: Error handling for invalid files and operations
- **4.4**: Text editing and annotation data structures
- **5.3**: Document library metadata management

All interfaces are designed to be type-safe, extensible, and provide comprehensive error handling for robust mobile PDF editing functionality.