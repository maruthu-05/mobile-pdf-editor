// File Manager implementation using Expo FileSystem
import * as FileSystem from 'expo-file-system';
import { FileManager as IFileManager } from './interfaces';
import { FileMetadata } from '../../types';
import { ErrorFactory, FileSystemError } from '../../types/errors';
import { DataValidator } from '../../types/validation';

export class FileManager implements IFileManager {
  private readonly documentsDirectory: string;
  private readonly cacheDirectory: string;

  constructor() {
    this.documentsDirectory = (FileSystem as any).documentDirectory || '';
    this.cacheDirectory = (FileSystem as any).cacheDirectory || '';
  }

  /**
   * Save file data to the local file system
   */
  async saveFile(data: Buffer | Uint8Array, fileName: string, directory?: string): Promise<string> {
    try {
      // Validate inputs
      if (!data || data.length === 0) {
        const error = ErrorFactory.createFileSystemError(
          'invalid_path',
          'File data cannot be empty',
          fileName
        );
        throw new Error(error.message);
      }

      if (!fileName || fileName.trim().length === 0) {
        const error = ErrorFactory.createFileSystemError(
          'invalid_path',
          'File name cannot be empty',
          fileName
        );
        throw new Error(error.message);
      }

      // Sanitize file name
      const sanitizedFileName = this.sanitizeFileName(fileName);
      
      // Determine target directory
      const targetDirectory = directory 
        ? `${this.documentsDirectory}${directory}/`
        : this.documentsDirectory;

      // Ensure directory exists
      await this.createDirectory(targetDirectory);

      // Create full file path
      const filePath = `${targetDirectory}${sanitizedFileName}`;

      // Check available space
      const availableSpace = await this.getAvailableSpace();
      if (data.length > availableSpace) {
        const error = ErrorFactory.createFileSystemError(
          'disk_full',
          `Insufficient storage space. Required: ${data.length} bytes, Available: ${availableSpace} bytes`,
          filePath
        );
        throw new Error(error.message);
      }

      // Convert data to base64 string for Expo FileSystem
      const base64Data = Buffer.from(data).toString('base64');

      // Write file
      await FileSystem.writeAsStringAsync(filePath, base64Data, {
        encoding: 'base64' as any,
      });

      return filePath;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      const fsError = ErrorFactory.createFileSystemError(
        'file_corruption',
        `Failed to save file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        fileName,
        error
      );
      throw new Error(fsError.message);
    }
  }

  /**
   * Delete a file from the local file system
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      if (!filePath || filePath.trim().length === 0) {
        const error = ErrorFactory.createFileSystemError(
          'invalid_path',
          'File path cannot be empty',
          filePath
        );
        throw new Error(error.message);
      }

      // Check if file exists
      const fileExists = await this.fileExists(filePath);
      if (!fileExists) {
        const error = ErrorFactory.createFileSystemError(
          'file_not_found',
          `File not found: ${filePath}`,
          filePath
        );
        throw new Error(error.message);
      }

      // Delete the file
      await FileSystem.deleteAsync(filePath);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      const fsError = ErrorFactory.createFileSystemError(
        'permission_denied',
        `Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        filePath,
        error
      );
      throw new Error(fsError.message);
    }
  }

  /**
   * List all files in a directory
   */
  async listFiles(directory?: string, extension?: string): Promise<FileMetadata[]> {
    try {
      const targetDirectory = directory || this.documentsDirectory;

      // Check if directory exists
      const dirInfo = await FileSystem.getInfoAsync(targetDirectory);
      if (!dirInfo.exists || !dirInfo.isDirectory) {
        return [];
      }

      // Read directory contents
      const files = await FileSystem.readDirectoryAsync(targetDirectory);
      const fileMetadataList: FileMetadata[] = [];

      for (const fileName of files) {
        const filePath = `${targetDirectory}${fileName}`;
        
        // Filter by extension if specified
        if (extension && !fileName.toLowerCase().endsWith(extension.toLowerCase())) {
          continue;
        }

        try {
          const metadata = await this.getFileInfo(filePath);
          fileMetadataList.push(metadata);
        } catch (error) {
          // Skip files that can't be read
          console.warn(`Failed to get info for file: ${filePath}`, error);
        }
      }

      return fileMetadataList;
    } catch (error) {
      throw ErrorFactory.createFileSystemError(
        'permission_denied',
        `Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}`,
        directory,
        error
      );
    }
  }

  /**
   * Get metadata information for a specific file
   */
  async getFileInfo(filePath: string): Promise<FileMetadata> {
    try {
      if (!filePath || filePath.trim().length === 0) {
        const error = ErrorFactory.createFileSystemError(
          'invalid_path',
          'File path cannot be empty',
          filePath
        );
        throw new Error(error.message);
      }

      const fileInfo = await FileSystem.getInfoAsync(filePath);
      
      if (!fileInfo.exists) {
        const error = ErrorFactory.createFileSystemError(
          'file_not_found',
          `File not found: ${filePath}`,
          filePath
        );
        throw new Error(error.message);
      }

      if (fileInfo.isDirectory) {
        const error = ErrorFactory.createFileSystemError(
          'invalid_path',
          `Path is a directory, not a file: ${filePath}`,
          filePath
        );
        throw new Error(error.message);
      }

      const fileName = filePath.split('/').pop() || '';
      const mimeType = this.getMimeType(fileName);

      const metadata: FileMetadata = {
        fileName,
        filePath,
        fileSize: (fileInfo as any).size || 0,
        createdAt: new Date((fileInfo as any).modificationTime || Date.now()),
        modifiedAt: new Date((fileInfo as any).modificationTime || Date.now()),
        mimeType,
      };

      // Validate the metadata
      const validation = DataValidator.validateFileMetadata(metadata);
      if (!validation.isValid) {
        const error = ErrorFactory.createFileSystemError(
          'file_corruption',
          `Invalid file metadata: ${validation.errors.map(e => e.message).join(', ')}`,
          filePath,
          validation.errors
        );
        throw new Error(error.message);
      }

      return metadata;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      const fsError = ErrorFactory.createFileSystemError(
        'permission_denied',
        `Failed to get file info: ${error instanceof Error ? error.message : 'Unknown error'}`,
        filePath,
        error
      );
      throw new Error(fsError.message);
    }
  }

  /**
   * Rename a file
   */
  async renameFile(oldPath: string, newName: string): Promise<string> {
    try {
      if (!oldPath || oldPath.trim().length === 0) {
        const error = ErrorFactory.createFileSystemError(
          'invalid_path',
          'Old file path cannot be empty',
          oldPath
        );
        throw new Error(error.message);
      }

      if (!newName || newName.trim().length === 0) {
        const error = ErrorFactory.createFileSystemError(
          'invalid_path',
          'New file name cannot be empty',
          newName
        );
        throw new Error(error.message);
      }

      // Check if source file exists
      const fileExists = await this.fileExists(oldPath);
      if (!fileExists) {
        const error = ErrorFactory.createFileSystemError(
          'file_not_found',
          `Source file not found: ${oldPath}`,
          oldPath
        );
        throw new Error(error.message);
      }

      // Sanitize new file name
      const sanitizedNewName = this.sanitizeFileName(newName);
      
      // Create new path
      const directory = oldPath.substring(0, oldPath.lastIndexOf('/') + 1);
      const newPath = `${directory}${sanitizedNewName}`;

      // Check if destination already exists
      const destExists = await this.fileExists(newPath);
      if (destExists) {
        const error = ErrorFactory.createFileSystemError(
          'file_corruption',
          `File already exists: ${newPath}`,
          newPath
        );
        throw new Error(error.message);
      }

      // Move file to new location (rename)
      await FileSystem.moveAsync({
        from: oldPath,
        to: newPath,
      });

      return newPath;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      const fsError = ErrorFactory.createFileSystemError(
        'permission_denied',
        `Failed to rename file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        oldPath,
        error
      );
      throw new Error(fsError.message);
    }
  }

  /**
   * Copy a file to a new location
   */
  async copyFile(sourcePath: string, destinationPath: string): Promise<string> {
    try {
      if (!sourcePath || sourcePath.trim().length === 0) {
        const error = ErrorFactory.createFileSystemError(
          'invalid_path',
          'Source path cannot be empty',
          sourcePath
        );
        throw new Error(error.message);
      }

      if (!destinationPath || destinationPath.trim().length === 0) {
        const error = ErrorFactory.createFileSystemError(
          'invalid_path',
          'Destination path cannot be empty',
          destinationPath
        );
        throw new Error(error.message);
      }

      // Check if source file exists
      const sourceExists = await this.fileExists(sourcePath);
      if (!sourceExists) {
        const error = ErrorFactory.createFileSystemError(
          'file_not_found',
          `Source file not found: ${sourcePath}`,
          sourcePath
        );
        throw new Error(error.message);
      }

      // Ensure destination directory exists
      const destDirectory = destinationPath.substring(0, destinationPath.lastIndexOf('/') + 1);
      await this.createDirectory(destDirectory);

      // Copy file
      await FileSystem.copyAsync({
        from: sourcePath,
        to: destinationPath,
      });

      return destinationPath;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      const fsError = ErrorFactory.createFileSystemError(
        'permission_denied',
        `Failed to copy file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        sourcePath,
        error
      );
      throw new Error(fsError.message);
    }
  }

  /**
   * Move a file to a new location
   */
  async moveFile(sourcePath: string, destinationPath: string): Promise<string> {
    try {
      if (!sourcePath || sourcePath.trim().length === 0) {
        throw ErrorFactory.createFileSystemError(
          'invalid_path',
          'Source path cannot be empty',
          sourcePath
        );
      }

      if (!destinationPath || destinationPath.trim().length === 0) {
        throw ErrorFactory.createFileSystemError(
          'invalid_path',
          'Destination path cannot be empty',
          destinationPath
        );
      }

      // Check if source file exists
      const sourceExists = await this.fileExists(sourcePath);
      if (!sourceExists) {
        throw ErrorFactory.createFileSystemError(
          'file_not_found',
          `Source file not found: ${sourcePath}`,
          sourcePath
        );
      }

      // Ensure destination directory exists
      const destDirectory = destinationPath.substring(0, destinationPath.lastIndexOf('/') + 1);
      await this.createDirectory(destDirectory);

      // Move file
      await FileSystem.moveAsync({
        from: sourcePath,
        to: destinationPath,
      });

      return destinationPath;
    } catch (error) {
      if (error instanceof Error && error.message.includes('file_system')) {
        throw error;
      }
      throw ErrorFactory.createFileSystemError(
        'permission_denied',
        `Failed to move file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        sourcePath,
        error
      );
    }
  }

  /**
   * Check if a file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      if (!filePath || filePath.trim().length === 0) {
        return false;
      }

      const fileInfo = await FileSystem.getInfoAsync(filePath);
      return fileInfo.exists && !fileInfo.isDirectory;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get available storage space
   */
  async getAvailableSpace(): Promise<number> {
    try {
      const diskInfo = await FileSystem.getFreeDiskStorageAsync();
      return diskInfo;
    } catch (error) {
      throw ErrorFactory.createFileSystemError(
        'permission_denied',
        `Failed to get available space: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        error
      );
    }
  }

  /**
   * Get total storage space used by the app
   */
  async getUsedSpace(): Promise<number> {
    try {
      const files = await this.listFiles();
      return files.reduce((total, file) => total + file.fileSize, 0);
    } catch (error) {
      throw ErrorFactory.createFileSystemError(
        'permission_denied',
        `Failed to calculate used space: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        error
      );
    }
  }

  /**
   * Create a directory if it doesn't exist
   */
  async createDirectory(directoryPath: string): Promise<void> {
    try {
      if (!directoryPath || directoryPath.trim().length === 0) {
        const error = ErrorFactory.createFileSystemError(
          'invalid_path',
          'Directory path cannot be empty',
          directoryPath
        );
        throw new Error(error.message);
      }

      const dirInfo = await FileSystem.getInfoAsync(directoryPath);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(directoryPath, { intermediates: true });
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      const fsError = ErrorFactory.createFileSystemError(
        'permission_denied',
        `Failed to create directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
        directoryPath,
        error
      );
      throw new Error(fsError.message);
    }
  }

  /**
   * Read file content as text
   */
  async readFileAsText(filePath: string, encoding: string = 'utf8'): Promise<string> {
    try {
      if (!filePath || filePath.trim().length === 0) {
        const error = ErrorFactory.createFileSystemError(
          'invalid_path',
          'File path cannot be empty',
          filePath
        );
        throw new Error(error.message);
      }

      const fileExists = await this.fileExists(filePath);
      if (!fileExists) {
        const error = ErrorFactory.createFileSystemError(
          'file_not_found',
          `File not found: ${filePath}`,
          filePath
        );
        throw new Error(error.message);
      }

      const content = await FileSystem.readAsStringAsync(filePath, {
        encoding: encoding === 'utf8' ? 'utf8' as any : 'base64' as any,
      });

      return content;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      const fsError = ErrorFactory.createFileSystemError(
        'file_corruption',
        `Failed to read file as text: ${error instanceof Error ? error.message : 'Unknown error'}`,
        filePath,
        error
      );
      throw new Error(fsError.message);
    }
  }

  /**
   * Read file content as binary data
   */
  async readFileAsBuffer(filePath: string): Promise<Buffer> {
    try {
      if (!filePath || filePath.trim().length === 0) {
        throw ErrorFactory.createFileSystemError(
          'invalid_path',
          'File path cannot be empty',
          filePath
        );
      }

      const fileExists = await this.fileExists(filePath);
      if (!fileExists) {
        throw ErrorFactory.createFileSystemError(
          'file_not_found',
          `File not found: ${filePath}`,
          filePath
        );
      }

      const base64Content = await FileSystem.readAsStringAsync(filePath, {
        encoding: 'base64' as any,
      });

      return Buffer.from(base64Content, 'base64');
    } catch (error) {
      if (error instanceof Error && error.message.includes('file_system')) {
        throw error;
      }
      throw ErrorFactory.createFileSystemError(
        'file_corruption',
        `Failed to read file as buffer: ${error instanceof Error ? error.message : 'Unknown error'}`,
        filePath,
        error
      );
    }
  }

  /**
   * Get the app's documents directory path
   */
  async getDocumentsDirectory(): Promise<string> {
    return this.documentsDirectory;
  }

  /**
   * Get the app's cache directory path
   */
  async getCacheDirectory(): Promise<string> {
    return this.cacheDirectory;
  }

  /**
   * Private helper methods
   */

  /**
   * Sanitize file name to remove invalid characters
   */
  private sanitizeFileName(fileName: string): string {
    // Replace each invalid character with an underscore
    return fileName
      .replace(/[<>:"/\\|?*]/g, '_')
      .trim();
  }

  /**
   * Get MIME type based on file extension
   */
  private getMimeType(fileName: string): string {
    const extension = fileName.toLowerCase().split('.').pop();
    
    const mimeTypes: { [key: string]: string } = {
      'pdf': 'application/pdf',
      'txt': 'text/plain',
      'json': 'application/json',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
    };

    return mimeTypes[extension || ''] || 'application/octet-stream';
  }
}