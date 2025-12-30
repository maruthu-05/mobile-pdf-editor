// PDF Engine types and interfaces

export interface PageRange {
  startPage: number;
  endPage: number;
}

export interface TextEdit {
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  newText: string;
}

export interface DrawingPath {
  points: { x: number; y: number }[];
  strokeWidth: number;
}

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

export interface PDFDocument {
  id: string;
  pageCount: number;
  filePath: string;
}

export interface ImageData {
  uri: string;
  width: number;
  height: number;
}

export interface PDFEngine {
  loadPDF(filePath: string): Promise<PDFDocument>;
  mergePDFs(filePaths: string[]): Promise<string>;
  splitPDF(filePath: string, pageRanges: PageRange[]): Promise<string[]>;
  editPDFText(filePath: string, edits: TextEdit[]): Promise<string>;
  addAnnotations(filePath: string, annotations: Annotation[]): Promise<string>;
  renderPage(filePath: string, pageNumber: number): Promise<ImageData>;
}