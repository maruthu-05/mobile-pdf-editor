import { FileMetadata } from '../../types';

/**
 * File Manager interface for local file system operations
 */
export interface FileManager {
  /**
   * Save file data to the local file system
   * @param data File data as Buffer or Uint8Array
   * @param fileName Name for the saved file
   * @param directory Optional subdirectory to save in
   * @returns Promise resolving to the full file path
   */
  saveFile(data: Buffer | Uint8Array, fileName: string, directory?: string): Promise<string>;

  /**
   * Delete a file from the local file system
   * @param filePath Path to the file to delete
   * @returns Promise that resolves when deletion is complete
   */
  deleteFile(filePath: string): Promise<void>;

  /**
   * List all files in a directory
   * @param directory Optional directory path (defaults to app documents directory)
   * @param extension Optional file extension filter
   * @returns Promise resolving to array of FileMetadata objects
   */
  listFiles(directory?: string, extension?: string): Promise<FileMetadata[]>;

  /**
   * Get metadata information for a specific file
   * @param filePath Path to the file
   * @returns Promise resolving to FileMetadata object
   */
  getFileInfo(filePath: string): Promise<FileMetadata>;

  /**
   * Rename a file
   * @param oldPath Current file path
   * @param newName New file name (without path)
   * @returns Promise resolving to the new file path
   */
  renameFile(oldPath: string, newName: string): Promise<string>;

  /**
   * Copy a file to a new location
   * @param sourcePath Source file path
   * @param destinationPath Destination file path
   * @returns Promise resolving to the destination file path
   */
  copyFile(sourcePath: string, destinationPath: string): Promise<string>;

  /**
   * Move a file to a new location
   * @param sourcePath Source file path
   * @param destinationPath Destination file path
   * @returns Promise resolving to the destination file path
   */
  moveFile(sourcePath: string, destinationPath: string): Promise<string>;

  /**
   * Check if a file exists
   * @param filePath Path to check
   * @returns Promise resolving to boolean indicating existence
   */
  fileExists(filePath: string): Promise<boolean>;

  /**
   * Get available storage space
   * @returns Promise resolving to available bytes
   */
  getAvailableSpace(): Promise<number>;

  /**
   * Get total storage space used by the app
   * @returns Promise resolving to used bytes
   */
  getUsedSpace(): Promise<number>;

  /**
   * Create a directory if it doesn't exist
   * @param directoryPath Path to the directory to create
   * @returns Promise that resolves when directory is created
   */
  createDirectory(directoryPath: string): Promise<void>;

  /**
   * Read file content as text
   * @param filePath Path to the file
   * @param encoding Optional encoding (default: 'utf8')
   * @returns Promise resolving to file content as string
   */
  readFileAsText(filePath: string, encoding?: string): Promise<string>;

  /**
   * Read file content as binary data
   * @param filePath Path to the file
   * @returns Promise resolving to file content as Buffer
   */
  readFileAsBuffer(filePath: string): Promise<Buffer>;

  /**
   * Get the app's documents directory path
   * @returns Promise resolving to the documents directory path
   */
  getDocumentsDirectory(): Promise<string>;

  /**
   * Get the app's cache directory path
   * @returns Promise resolving to the cache directory path
   */
  getCacheDirectory(): Promise<string>;
}