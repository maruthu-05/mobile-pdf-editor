import * as FileSystem from 'expo-file-system';
import { FileManager } from '../FileManager';
import { ErrorFactory } from '../../../types/errors';

// Mock Expo FileSystem
jest.mock('expo-file-system');

const mockFileSystem = FileSystem as jest.Mocked<typeof FileSystem>;

// Define mock FileInfo interface to match expected structure
interface MockFileInfo {
  exists: boolean;
  isDirectory: boolean;
  uri: string;
  size?: number;
  modificationTime?: number;
}

describe('FileManager', () => {
  let fileManager: FileManager;

  beforeEach(() => {
    fileManager = new FileManager();
    jest.clearAllMocks();
  });

  describe('saveFile', () => {
    it('should save file successfully with valid data', async () => {
      const testData = Buffer.from('test content');
      const fileName = 'test.pdf';
      const expectedPath = '/mock/documents/test.pdf';

      const mockFileInfo: MockFileInfo = {
        exists: false,
        isDirectory: false,
        uri: '',
        size: 0,
        modificationTime: 0,
      };

      mockFileSystem.getInfoAsync.mockResolvedValue(mockFileInfo as any);
      mockFileSystem.makeDirectoryAsync.mockResolvedValue();
      mockFileSystem.writeAsStringAsync.mockResolvedValue();
      mockFileSystem.getFreeDiskStorageAsync.mockResolvedValue(1000000);

      const result = await fileManager.saveFile(testData, fileName);

      expect(result).toBe(expectedPath);
      expect(mockFileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        expectedPath,
        testData.toString('base64'),
        { encoding: 'base64' }
      );
    });

    it('should save file in specified directory', async () => {
      const testData = Buffer.from('test content');
      const fileName = 'test.pdf';
      const directory = 'pdfs';
      const expectedPath = '/mock/documents/pdfs/test.pdf';

      const mockFileInfo: MockFileInfo = {
        exists: false,
        isDirectory: false,
        uri: '',
        size: 0,
        modificationTime: 0,
      };

      mockFileSystem.getInfoAsync.mockResolvedValue(mockFileInfo as any);
      mockFileSystem.makeDirectoryAsync.mockResolvedValue();
      mockFileSystem.writeAsStringAsync.mockResolvedValue();
      mockFileSystem.getFreeDiskStorageAsync.mockResolvedValue(1000000);

      const result = await fileManager.saveFile(testData, fileName, directory);

      expect(result).toBe(expectedPath);
      expect(mockFileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
        '/mock/documents/pdfs/',
        { intermediates: true }
      );
    });

    it('should throw error for empty data', async () => {
      const emptyData = Buffer.alloc(0);
      const fileName = 'test.pdf';

      await expect(fileManager.saveFile(emptyData, fileName)).rejects.toThrow();
    });

    it('should throw error for empty filename', async () => {
      const testData = Buffer.from('test content');
      const fileName = '';

      await expect(fileManager.saveFile(testData, fileName)).rejects.toThrow();
    });

    it('should throw error when insufficient storage space', async () => {
      const testData = Buffer.from('test content');
      const fileName = 'test.pdf';

      mockFileSystem.getFreeDiskStorageAsync.mockResolvedValue(5); // Less than data size

      await expect(fileManager.saveFile(testData, fileName)).rejects.toThrow();
    });

    it('should sanitize filename with invalid characters', async () => {
      const testData = Buffer.from('test content');
      const fileName = 'test<>:"/\\|?*.pdf';
      const expectedPath = '/mock/documents/test_________.pdf';

      const mockFileInfo: MockFileInfo = {
        exists: false,
        isDirectory: false,
        uri: '',
        size: 0,
        modificationTime: 0,
      };

      mockFileSystem.getInfoAsync.mockResolvedValue(mockFileInfo as any);
      mockFileSystem.makeDirectoryAsync.mockResolvedValue();
      mockFileSystem.writeAsStringAsync.mockResolvedValue();
      mockFileSystem.getFreeDiskStorageAsync.mockResolvedValue(1000000);

      const result = await fileManager.saveFile(testData, fileName);

      expect(result).toBe(expectedPath);
    });
  });

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      const filePath = '/mock/documents/test.pdf';

      const mockFileInfo: MockFileInfo = {
        exists: true,
        isDirectory: false,
        uri: filePath,
        size: 100,
        modificationTime: Date.now(),
      };

      mockFileSystem.getInfoAsync.mockResolvedValue(mockFileInfo as any);
      mockFileSystem.deleteAsync.mockResolvedValue();

      await fileManager.deleteFile(filePath);

      expect(mockFileSystem.deleteAsync).toHaveBeenCalledWith(filePath);
    });

    it('should throw error for empty file path', async () => {
      await expect(fileManager.deleteFile('')).rejects.toThrow();
    });

    it('should throw error when file does not exist', async () => {
      const filePath = '/mock/documents/nonexistent.pdf';

      const mockFileInfo: MockFileInfo = {
        exists: false,
        isDirectory: false,
        uri: '',
        size: 0,
        modificationTime: 0,
      };

      mockFileSystem.getInfoAsync.mockResolvedValue(mockFileInfo as any);

      await expect(fileManager.deleteFile(filePath)).rejects.toThrow();
    });
  });

  describe('listFiles', () => {
    it('should list files in default directory', async () => {
      const mockFiles = ['file1.pdf', 'file2.pdf', 'file3.txt'];
      
      const mockDirInfo: MockFileInfo = {
        exists: true,
        isDirectory: true,
        uri: '/mock/documents/',
        size: 0,
        modificationTime: Date.now(),
      };

      const mockFile1Info: MockFileInfo = {
        exists: true,
        isDirectory: false,
        uri: '/mock/documents/file1.pdf',
        size: 100,
        modificationTime: Date.now(),
      };

      const mockFile2Info: MockFileInfo = {
        exists: true,
        isDirectory: false,
        uri: '/mock/documents/file2.pdf',
        size: 200,
        modificationTime: Date.now(),
      };

      const mockFile3Info: MockFileInfo = {
        exists: true,
        isDirectory: false,
        uri: '/mock/documents/file3.txt',
        size: 50,
        modificationTime: Date.now(),
      };

      mockFileSystem.getInfoAsync
        .mockResolvedValueOnce(mockDirInfo as any)
        .mockResolvedValueOnce(mockFile1Info as any)
        .mockResolvedValueOnce(mockFile2Info as any)
        .mockResolvedValueOnce(mockFile3Info as any);

      mockFileSystem.readDirectoryAsync.mockResolvedValue(mockFiles);

      const result = await fileManager.listFiles();

      expect(result).toHaveLength(3);
      expect(result[0].fileName).toBe('file1.pdf');
      expect(result[1].fileName).toBe('file2.pdf');
      expect(result[2].fileName).toBe('file3.txt');
    });

    it('should filter files by extension', async () => {
      const mockFiles = ['file1.pdf', 'file2.pdf', 'file3.txt'];
      
      const mockDirInfo: MockFileInfo = {
        exists: true,
        isDirectory: true,
        uri: '/mock/documents/',
        size: 0,
        modificationTime: Date.now(),
      };

      const mockFile1Info: MockFileInfo = {
        exists: true,
        isDirectory: false,
        uri: '/mock/documents/file1.pdf',
        size: 100,
        modificationTime: Date.now(),
      };

      const mockFile2Info: MockFileInfo = {
        exists: true,
        isDirectory: false,
        uri: '/mock/documents/file2.pdf',
        size: 200,
        modificationTime: Date.now(),
      };

      mockFileSystem.getInfoAsync
        .mockResolvedValueOnce(mockDirInfo as any)
        .mockResolvedValueOnce(mockFile1Info as any)
        .mockResolvedValueOnce(mockFile2Info as any);

      mockFileSystem.readDirectoryAsync.mockResolvedValue(mockFiles);

      const result = await fileManager.listFiles(undefined, '.pdf');

      expect(result).toHaveLength(2);
      expect(result[0].fileName).toBe('file1.pdf');
      expect(result[1].fileName).toBe('file2.pdf');
    });

    it('should return empty array for non-existent directory', async () => {
      const mockFileInfo: MockFileInfo = {
        exists: false,
        isDirectory: false,
        uri: '',
        size: 0,
        modificationTime: 0,
      };

      mockFileSystem.getInfoAsync.mockResolvedValue(mockFileInfo as any);

      const result = await fileManager.listFiles('/nonexistent/');

      expect(result).toEqual([]);
    });
  });

  describe('getFileInfo', () => {
    it('should return file metadata successfully', async () => {
      const filePath = '/mock/documents/test.pdf';
      const mockTime = Date.now();

      const mockFileInfo: MockFileInfo = {
        exists: true,
        isDirectory: false,
        uri: filePath,
        size: 1024,
        modificationTime: mockTime,
      };

      mockFileSystem.getInfoAsync.mockResolvedValue(mockFileInfo as any);

      const result = await fileManager.getFileInfo(filePath);

      expect(result.fileName).toBe('test.pdf');
      expect(result.filePath).toBe(filePath);
      expect(result.fileSize).toBe(1024);
      expect(result.mimeType).toBe('application/pdf');
      expect(result.createdAt).toEqual(new Date(mockTime));
      expect(result.modifiedAt).toEqual(new Date(mockTime));
    });

    it('should throw error for empty file path', async () => {
      await expect(fileManager.getFileInfo('')).rejects.toThrow();
    });

    it('should throw error when file does not exist', async () => {
      const filePath = '/mock/documents/nonexistent.pdf';

      const mockFileInfo: MockFileInfo = {
        exists: false,
        isDirectory: false,
        uri: '',
        size: 0,
        modificationTime: 0,
      };

      mockFileSystem.getInfoAsync.mockResolvedValue(mockFileInfo as any);

      await expect(fileManager.getFileInfo(filePath)).rejects.toThrow();
    });

    it('should throw error when path is a directory', async () => {
      const filePath = '/mock/documents/';

      const mockFileInfo: MockFileInfo = {
        exists: true,
        isDirectory: true,
        uri: filePath,
        size: 0,
        modificationTime: Date.now(),
      };

      mockFileSystem.getInfoAsync.mockResolvedValue(mockFileInfo as any);

      await expect(fileManager.getFileInfo(filePath)).rejects.toThrow();
    });
  });

  describe('renameFile', () => {
    it('should rename file successfully', async () => {
      const oldPath = '/mock/documents/old.pdf';
      const newName = 'new.pdf';
      const expectedNewPath = '/mock/documents/new.pdf';

      const mockOldFileInfo: MockFileInfo = {
        exists: true,
        isDirectory: false,
        uri: oldPath,
        size: 100,
        modificationTime: Date.now(),
      };

      const mockNewFileInfo: MockFileInfo = {
        exists: false,
        isDirectory: false,
        uri: '',
        size: 0,
        modificationTime: 0,
      };

      mockFileSystem.getInfoAsync
        .mockResolvedValueOnce(mockOldFileInfo as any)
        .mockResolvedValueOnce(mockNewFileInfo as any);

      mockFileSystem.moveAsync.mockResolvedValue();

      const result = await fileManager.renameFile(oldPath, newName);

      expect(result).toBe(expectedNewPath);
      expect(mockFileSystem.moveAsync).toHaveBeenCalledWith({
        from: oldPath,
        to: expectedNewPath,
      });
    });

    it('should throw error for empty old path', async () => {
      await expect(fileManager.renameFile('', 'new.pdf')).rejects.toThrow();
    });

    it('should throw error for empty new name', async () => {
      await expect(fileManager.renameFile('/mock/documents/old.pdf', '')).rejects.toThrow();
    });

    it('should throw error when source file does not exist', async () => {
      const oldPath = '/mock/documents/nonexistent.pdf';
      const newName = 'new.pdf';

      const mockFileInfo: MockFileInfo = {
        exists: false,
        isDirectory: false,
        uri: '',
        size: 0,
        modificationTime: 0,
      };

      mockFileSystem.getInfoAsync.mockResolvedValue(mockFileInfo as any);

      await expect(fileManager.renameFile(oldPath, newName)).rejects.toThrow();
    });

    it('should throw error when destination already exists', async () => {
      const oldPath = '/mock/documents/old.pdf';
      const newName = 'existing.pdf';

      const mockOldFileInfo: MockFileInfo = {
        exists: true,
        isDirectory: false,
        uri: oldPath,
        size: 100,
        modificationTime: Date.now(),
      };

      const mockExistingFileInfo: MockFileInfo = {
        exists: true,
        isDirectory: false,
        uri: '/mock/documents/existing.pdf',
        size: 200,
        modificationTime: Date.now(),
      };

      mockFileSystem.getInfoAsync
        .mockResolvedValueOnce(mockOldFileInfo as any)
        .mockResolvedValueOnce(mockExistingFileInfo as any);

      await expect(fileManager.renameFile(oldPath, newName)).rejects.toThrow();
    });
  });

  describe('copyFile', () => {
    it('should copy file successfully', async () => {
      const sourcePath = '/mock/documents/source.pdf';
      const destinationPath = '/mock/documents/copy.pdf';

      const mockSourceFileInfo: MockFileInfo = {
        exists: true,
        isDirectory: false,
        uri: sourcePath,
        size: 100,
        modificationTime: Date.now(),
      };

      const mockDestFileInfo: MockFileInfo = {
        exists: false,
        isDirectory: false,
        uri: '',
        size: 0,
        modificationTime: 0,
      };

      mockFileSystem.getInfoAsync
        .mockResolvedValueOnce(mockSourceFileInfo as any)
        .mockResolvedValueOnce(mockDestFileInfo as any);

      mockFileSystem.makeDirectoryAsync.mockResolvedValue();
      mockFileSystem.copyAsync.mockResolvedValue();

      const result = await fileManager.copyFile(sourcePath, destinationPath);

      expect(result).toBe(destinationPath);
      expect(mockFileSystem.copyAsync).toHaveBeenCalledWith({
        from: sourcePath,
        to: destinationPath,
      });
    });

    it('should throw error for empty source path', async () => {
      await expect(fileManager.copyFile('', '/dest.pdf')).rejects.toThrow();
    });

    it('should throw error when source file does not exist', async () => {
      const sourcePath = '/mock/documents/nonexistent.pdf';
      const destinationPath = '/mock/documents/copy.pdf';

      const mockFileInfo: MockFileInfo = {
        exists: false,
        isDirectory: false,
        uri: '',
        size: 0,
        modificationTime: 0,
      };

      mockFileSystem.getInfoAsync.mockResolvedValue(mockFileInfo as any);

      await expect(fileManager.copyFile(sourcePath, destinationPath)).rejects.toThrow();
    });
  });

  describe('moveFile', () => {
    it('should move file successfully', async () => {
      const sourcePath = '/mock/documents/source.pdf';
      const destinationPath = '/mock/documents/moved.pdf';

      const mockFileInfo: MockFileInfo = {
        exists: true,
        isDirectory: false,
        uri: sourcePath,
        size: 100,
        modificationTime: Date.now(),
      };

      mockFileSystem.getInfoAsync.mockResolvedValue(mockFileInfo as any);
      mockFileSystem.makeDirectoryAsync.mockResolvedValue();
      mockFileSystem.moveAsync.mockResolvedValue();

      const result = await fileManager.moveFile(sourcePath, destinationPath);

      expect(result).toBe(destinationPath);
      expect(mockFileSystem.moveAsync).toHaveBeenCalledWith({
        from: sourcePath,
        to: destinationPath,
      });
    });
  });

  describe('fileExists', () => {
    it('should return true for existing file', async () => {
      const filePath = '/mock/documents/test.pdf';

      const mockFileInfo: MockFileInfo = {
        exists: true,
        isDirectory: false,
        uri: filePath,
        size: 100,
        modificationTime: Date.now(),
      };

      mockFileSystem.getInfoAsync.mockResolvedValue(mockFileInfo as any);

      const result = await fileManager.fileExists(filePath);

      expect(result).toBe(true);
    });

    it('should return false for non-existing file', async () => {
      const filePath = '/mock/documents/nonexistent.pdf';

      const mockFileInfo: MockFileInfo = {
        exists: false,
        isDirectory: false,
        uri: '',
        size: 0,
        modificationTime: 0,
      };

      mockFileSystem.getInfoAsync.mockResolvedValue(mockFileInfo as any);

      const result = await fileManager.fileExists(filePath);

      expect(result).toBe(false);
    });

    it('should return false for directory', async () => {
      const filePath = '/mock/documents/';

      const mockFileInfo: MockFileInfo = {
        exists: true,
        isDirectory: true,
        uri: filePath,
        size: 0,
        modificationTime: Date.now(),
      };

      mockFileSystem.getInfoAsync.mockResolvedValue(mockFileInfo as any);

      const result = await fileManager.fileExists(filePath);

      expect(result).toBe(false);
    });

    it('should return false for empty path', async () => {
      const result = await fileManager.fileExists('');

      expect(result).toBe(false);
    });
  });

  describe('getAvailableSpace', () => {
    it('should return available disk space', async () => {
      const mockSpace = 1000000;

      mockFileSystem.getFreeDiskStorageAsync.mockResolvedValue(mockSpace);

      const result = await fileManager.getAvailableSpace();

      expect(result).toBe(mockSpace);
    });
  });

  describe('getUsedSpace', () => {
    it('should calculate total used space', async () => {
      const mockFiles = ['file1.pdf', 'file2.pdf'];
      
      const mockDirInfo: MockFileInfo = {
        exists: true,
        isDirectory: true,
        uri: '/mock/documents/',
        size: 0,
        modificationTime: Date.now(),
      };

      const mockFile1Info: MockFileInfo = {
        exists: true,
        isDirectory: false,
        uri: '/mock/documents/file1.pdf',
        size: 100,
        modificationTime: Date.now(),
      };

      const mockFile2Info: MockFileInfo = {
        exists: true,
        isDirectory: false,
        uri: '/mock/documents/file2.pdf',
        size: 200,
        modificationTime: Date.now(),
      };

      mockFileSystem.getInfoAsync
        .mockResolvedValueOnce(mockDirInfo as any)
        .mockResolvedValueOnce(mockFile1Info as any)
        .mockResolvedValueOnce(mockFile2Info as any);

      mockFileSystem.readDirectoryAsync.mockResolvedValue(mockFiles);

      const result = await fileManager.getUsedSpace();

      expect(result).toBe(300);
    });
  });

  describe('createDirectory', () => {
    it('should create directory successfully', async () => {
      const directoryPath = '/mock/documents/new-folder/';

      const mockFileInfo: MockFileInfo = {
        exists: false,
        isDirectory: false,
        uri: '',
        size: 0,
        modificationTime: 0,
      };

      mockFileSystem.getInfoAsync.mockResolvedValue(mockFileInfo as any);
      mockFileSystem.makeDirectoryAsync.mockResolvedValue();

      await fileManager.createDirectory(directoryPath);

      expect(mockFileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
        directoryPath,
        { intermediates: true }
      );
    });

    it('should not create directory if it already exists', async () => {
      const directoryPath = '/mock/documents/existing-folder/';

      const mockFileInfo: MockFileInfo = {
        exists: true,
        isDirectory: true,
        uri: directoryPath,
        size: 0,
        modificationTime: Date.now(),
      };

      mockFileSystem.getInfoAsync.mockResolvedValue(mockFileInfo as any);

      await fileManager.createDirectory(directoryPath);

      expect(mockFileSystem.makeDirectoryAsync).not.toHaveBeenCalled();
    });

    it('should throw error for empty directory path', async () => {
      await expect(fileManager.createDirectory('')).rejects.toThrow();
    });
  });

  describe('readFileAsText', () => {
    it('should read file as text successfully', async () => {
      const filePath = '/mock/documents/test.txt';
      const mockContent = 'test content';

      const mockFileInfo: MockFileInfo = {
        exists: true,
        isDirectory: false,
        uri: filePath,
        size: 100,
        modificationTime: Date.now(),
      };

      mockFileSystem.getInfoAsync.mockResolvedValue(mockFileInfo as any);
      mockFileSystem.readAsStringAsync.mockResolvedValue(mockContent);

      const result = await fileManager.readFileAsText(filePath);

      expect(result).toBe(mockContent);
      expect(mockFileSystem.readAsStringAsync).toHaveBeenCalledWith(
        filePath,
        { encoding: 'utf8' }
      );
    });

    it('should throw error when file does not exist', async () => {
      const filePath = '/mock/documents/nonexistent.txt';

      const mockFileInfo: MockFileInfo = {
        exists: false,
        isDirectory: false,
        uri: '',
        size: 0,
        modificationTime: 0,
      };

      mockFileSystem.getInfoAsync.mockResolvedValue(mockFileInfo as any);

      await expect(fileManager.readFileAsText(filePath)).rejects.toThrow();
    });
  });

  describe('readFileAsBuffer', () => {
    it('should read file as buffer successfully', async () => {
      const filePath = '/mock/documents/test.pdf';
      const mockBase64Content = 'dGVzdCBjb250ZW50'; // 'test content' in base64

      const mockFileInfo: MockFileInfo = {
        exists: true,
        isDirectory: false,
        uri: filePath,
        size: 100,
        modificationTime: Date.now(),
      };

      mockFileSystem.getInfoAsync.mockResolvedValue(mockFileInfo as any);
      mockFileSystem.readAsStringAsync.mockResolvedValue(mockBase64Content);

      const result = await fileManager.readFileAsBuffer(filePath);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString()).toBe('test content');
      expect(mockFileSystem.readAsStringAsync).toHaveBeenCalledWith(
        filePath,
        { encoding: 'base64' }
      );
    });
  });

  describe('getDocumentsDirectory', () => {
    it('should return documents directory path', async () => {
      const result = await fileManager.getDocumentsDirectory();

      expect(result).toBe('/mock/documents/');
    });
  });

  describe('getCacheDirectory', () => {
    it('should return cache directory path', async () => {
      const result = await fileManager.getCacheDirectory();

      expect(result).toBe('/mock/cache/');
    });
  });
});