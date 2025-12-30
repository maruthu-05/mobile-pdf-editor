import { PDFDocument, PageRange, TextEdit, Annotation, ImageData } from '../../types';

/**
 * PDF Engine interface for all PDF manipulation operations
 */
export interface PDFEngine {
  /**
   * Load a PDF document from file path
   * @param filePath Path to the PDF file
   * @returns Promise resolving to PDFDocument object
   */
  loadPDF(filePath: string): Promise<PDFDocument>;

  /**
   * Merge multiple PDF files into a single document
   * @param filePaths Array of PDF file paths to merge
   * @returns Promise resolving to the path of the merged PDF
   */
  mergePDFs(filePaths: string[]): Promise<string>;

  /**
   * Split a PDF document into multiple files based on page ranges
   * @param filePath Path to the source PDF file
   * @param pageRanges Array of page ranges to extract
   * @returns Promise resolving to array of paths of the split PDF files
   */
  splitPDF(filePath: string, pageRanges: PageRange[]): Promise<string[]>;

  /**
   * Edit text content in a PDF document
   * @param filePath Path to the PDF file
   * @param edits Array of text edits to apply
   * @returns Promise resolving to the path of the edited PDF
   */
  editPDFText(filePath: string, edits: TextEdit[]): Promise<string>;

  /**
   * Add annotations to a PDF document
   * @param filePath Path to the PDF file
   * @param annotations Array of annotations to add
   * @returns Promise resolving to the path of the annotated PDF
   */
  addAnnotations(filePath: string, annotations: Annotation[]): Promise<string>;

  /**
   * Render a specific page of a PDF as an image
   * @param filePath Path to the PDF file
   * @param pageNumber Page number to render (1-based)
   * @param scale Optional scale factor for rendering (default: 1.0)
   * @returns Promise resolving to ImageData object
   */
  renderPage(filePath: string, pageNumber: number, scale?: number): Promise<ImageData>;

  /**
   * Get the number of pages in a PDF document
   * @param filePath Path to the PDF file
   * @returns Promise resolving to the number of pages
   */
  getPageCount(filePath: string): Promise<number>;

  /**
   * Generate thumbnail for a PDF document (first page)
   * @param filePath Path to the PDF file
   * @param maxWidth Maximum width of the thumbnail
   * @param maxHeight Maximum height of the thumbnail
   * @returns Promise resolving to ImageData object
   */
  generateThumbnail(filePath: string, maxWidth: number, maxHeight: number): Promise<ImageData>;

  /**
   * Validate if a file is a valid PDF
   * @param filePath Path to the file to validate
   * @returns Promise resolving to boolean indicating validity
   */
  validatePDF(filePath: string): Promise<boolean>;

  /**
   * Extract text content from a PDF page
   * @param filePath Path to the PDF file
   * @param pageNumber Page number to extract text from (1-based)
   * @returns Promise resolving to extracted text content
   */
  extractTextFromPage(filePath: string, pageNumber: number): Promise<string>;

  /**
   * Extract specific pages from a PDF document into a new PDF
   * @param filePath Path to the source PDF file
   * @param pageNumbers Array of page numbers to extract (1-based)
   * @returns Promise resolving to the path of the new PDF with extracted pages
   */
  extractPages(filePath: string, pageNumbers: number[]): Promise<string>;

  /**
   * Delete specific pages from a PDF document
   * @param filePath Path to the source PDF file
   * @param pageNumbers Array of page numbers to delete (1-based)
   * @returns Promise resolving to the path of the new PDF with pages removed
   */
  deletePages(filePath: string, pageNumbers: number[]): Promise<string>;
}