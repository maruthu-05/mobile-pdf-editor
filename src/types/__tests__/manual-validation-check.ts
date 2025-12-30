// Manual validation check to verify all interfaces and validation functions work correctly
import { DataValidator } from '../validation';
import { DocumentMetadata, PageRange, TextEdit, Annotation, DrawingPath } from '../index';

/**
 * Simple test runner for validation functions
 */
function runValidationTests(): void {
  console.log('Starting manual validation checks...');
  let passedTests = 0;
  let totalTests = 0;

  function test(name: string, testFn: () => boolean): void {
    totalTests++;
    try {
      const result = testFn();
      if (result) {
        console.log(`✓ ${name}: PASS`);
        passedTests++;
      } else {
        console.log(`✗ ${name}: FAIL`);
      }
    } catch (error) {
      console.log(`✗ ${name}: ERROR - ${error}`);
    }
  }

  // Test DocumentMetadata validation
  console.log('\n1. Testing DocumentMetadata validation:');
  
  test('Valid DocumentMetadata should pass validation', () => {
    const validMetadata: DocumentMetadata = {
      id: 'doc-123',
      fileName: 'test.pdf',
      filePath: '/path/to/test.pdf',
      fileSize: 1024,
      pageCount: 5,
      createdAt: new Date(),
      modifiedAt: new Date(),
      thumbnailPath: '/path/to/thumbnail.jpg',
    };
    const result = DataValidator.validateDocumentMetadata(validMetadata);
    return result.isValid && result.errors.length === 0;
  });

  test('Invalid DocumentMetadata should fail validation', () => {
    const invalidMetadata = {
      id: '',
      fileName: 123,
      fileSize: -1,
    };
    const result = DataValidator.validateDocumentMetadata(invalidMetadata);
    return !result.isValid && result.errors.length > 0;
  });

  // Test PageRange validation
  console.log('\n2. Testing PageRange validation:');
  
  test('Valid PageRange should pass validation', () => {
    const validRange: PageRange = {
      startPage: 1,
      endPage: 5,
    };
    const result = DataValidator.validatePageRange(validRange);
    return result.isValid && result.errors.length === 0;
  });

  test('Invalid PageRange should fail validation', () => {
    const invalidRange = {
      startPage: 5,
      endPage: 1, // end page less than start page
    };
    const result = DataValidator.validatePageRange(invalidRange);
    return !result.isValid && result.errors.length > 0;
  });

  // Test TextEdit validation
  console.log('\n3. Testing TextEdit validation:');
  
  test('Valid TextEdit should pass validation', () => {
    const validEdit: TextEdit = {
      pageNumber: 1,
      x: 100,
      y: 200,
      width: 150,
      height: 20,
      newText: 'Updated text',
    };
    const result = DataValidator.validateTextEdit(validEdit);
    return result.isValid && result.errors.length === 0;
  });

  test('Invalid TextEdit should fail validation', () => {
    const invalidEdit = {
      pageNumber: 0,
      x: -10,
      y: -5,
      width: 0,
      height: -1,
      newText: 123,
    };
    const result = DataValidator.validateTextEdit(invalidEdit);
    return !result.isValid && result.errors.length > 0;
  });

  // Test DrawingPath validation
  console.log('\n4. Testing DrawingPath validation:');
  
  test('Valid DrawingPath should pass validation', () => {
    const validPath: DrawingPath = {
      points: [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
        { x: 50, y: 60 },
      ],
      strokeWidth: 2,
      strokeColor: '#FF0000',
    };
    const result = DataValidator.validateDrawingPath(validPath);
    return result.isValid && result.errors.length === 0;
  });

  test('Invalid DrawingPath should fail validation', () => {
    const invalidPath = {
      points: [{ x: 10 }], // missing y coordinate and insufficient points
      strokeWidth: -1,
      strokeColor: 'invalid-color',
    };
    const result = DataValidator.validateDrawingPath(invalidPath);
    return !result.isValid && result.errors.length > 0;
  });

  // Test Annotation validation
  console.log('\n5. Testing Annotation validation:');
  
  test('Valid text Annotation should pass validation', () => {
    const validAnnotation: Annotation = {
      type: 'text',
      pageNumber: 1,
      x: 100,
      y: 200,
      width: 150,
      height: 20,
      content: 'This is a text annotation',
      color: '#0000FF',
    };
    const result = DataValidator.validateAnnotation(validAnnotation);
    return result.isValid && result.errors.length === 0;
  });

  test('Valid drawing Annotation should pass validation', () => {
    const validAnnotation: Annotation = {
      type: 'drawing',
      pageNumber: 1,
      x: 100,
      y: 200,
      width: 150,
      height: 100,
      content: {
        points: [
          { x: 10, y: 20 },
          { x: 30, y: 40 },
        ],
        strokeWidth: 2,
        strokeColor: '#FF0000',
      },
      color: '#FF0000',
    };
    const result = DataValidator.validateAnnotation(validAnnotation);
    return result.isValid && result.errors.length === 0;
  });

  test('Invalid Annotation should fail validation', () => {
    const invalidAnnotation = {
      type: 'invalid-type',
      pageNumber: 1,
      x: 100,
      y: 200,
      width: 150,
      height: 20,
      content: 'text',
      color: '#0000FF',
    };
    const result = DataValidator.validateAnnotation(invalidAnnotation);
    return !result.isValid && result.errors.length > 0;
  });

  // Test PDF filename validation
  console.log('\n6. Testing PDF filename validation:');
  
  test('Valid PDF filename should pass validation', () => {
    const result = DataValidator.validatePDFFileName('document.pdf');
    return result.isValid && result.errors.length === 0;
  });

  test('Invalid PDF filename should fail validation', () => {
    const result = DataValidator.validatePDFFileName('document.txt');
    return !result.isValid && result.errors.length > 0;
  });

  // Test page number validation
  console.log('\n7. Testing page number validation:');
  
  test('Valid page number should pass validation', () => {
    const result = DataValidator.validatePageNumber(3, 10);
    return result.isValid && result.errors.length === 0;
  });

  test('Invalid page number should fail validation', () => {
    const result = DataValidator.validatePageNumber(15, 10);
    return !result.isValid && result.errors.length > 0;
  });

  // Summary
  console.log(`\n=== Test Results ===`);
  console.log(`Passed: ${passedTests}/${totalTests}`);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All validation tests passed!');
  } else {
    console.log('❌ Some validation tests failed.');
  }
}

// Run the tests
runValidationTests();