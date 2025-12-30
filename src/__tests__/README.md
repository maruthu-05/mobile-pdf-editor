# Comprehensive Test Suite

This directory contains a comprehensive test suite for the Mobile PDF Editor application, covering all aspects of functionality, performance, accessibility, and cross-platform compatibility.

## 📁 Test Structure

```
src/__tests__/
├── __mocks__/                    # Mock implementations for external dependencies
├── accessibility/                # Accessibility and usability tests
├── cross-platform/              # iOS and Android compatibility tests
├── e2e/                         # End-to-end user workflow tests
├── performance/                 # Performance benchmarks and regression tests
├── pipeline/                    # Test pipeline configuration and automation
├── test-data/                   # Test data management and mock generators
├── navigation.integration.test.ts # Navigation integration tests
├── offline-functionality.integration.test.ts # Offline capability tests
├── run-comprehensive-tests.ts   # Main test runner
├── setup.ts                     # Test environment setup
└── README.md                    # This file
```

## 🧪 Test Categories

### 1. Unit Tests
- **Location**: `src/modules/**/__tests__/**/*.test.ts`
- **Purpose**: Test individual components and modules in isolation
- **Coverage**: Core business logic, utilities, hooks, and data models
- **Execution Time**: < 5 seconds per test
- **Command**: `npm run test:unit`

### 2. Integration Tests
- **Location**: `src/__tests__/**/*.integration.test.ts`
- **Purpose**: Test interactions between modules and components
- **Coverage**: Module integration, component integration, navigation flows
- **Execution Time**: < 15 seconds per test
- **Command**: `npm run test:integration`

### 3. End-to-End Tests
- **Location**: `src/__tests__/e2e/**/*.e2e.test.ts`
- **Purpose**: Test complete user workflows from start to finish
- **Coverage**: Upload→Edit→Save, Merge, Split, Error Recovery workflows
- **Execution Time**: < 30 seconds per test
- **Command**: `npm run test:e2e`

### 4. Performance Tests
- **Location**: `src/__tests__/performance/**/*.test.ts`
- **Purpose**: Measure and validate performance metrics
- **Coverage**: Load times, memory usage, rendering performance, concurrent operations
- **Execution Time**: < 60 seconds per test
- **Command**: `npm run test:performance`

### 5. Accessibility Tests
- **Location**: `src/__tests__/accessibility/**/*.test.ts`
- **Purpose**: Ensure accessibility compliance and usability
- **Coverage**: Screen reader support, touch interactions, focus management
- **Execution Time**: < 10 seconds per test
- **Command**: `npm run test:accessibility`

### 6. Cross-Platform Tests
- **Location**: `src/__tests__/cross-platform/**/*.test.ts`
- **Purpose**: Verify consistent behavior across iOS and Android
- **Coverage**: File system operations, UI components, platform-specific features
- **Execution Time**: < 20 seconds per test
- **Command**: `npm run test:cross-platform`

## 🚀 Running Tests

### Quick Commands

```bash
# Run all tests
npm run test:all

# Run specific test categories
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:performance
npm run test:accessibility
npm run test:cross-platform

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run comprehensive test suite
npm run test:comprehensive
```

### Advanced Usage

```bash
# Run tests for specific files
npm test -- --testPathPattern=PDFEngine

# Run tests with specific timeout
npm test -- --testTimeout=30000

# Run tests in parallel
npm test -- --maxWorkers=4

# Run tests with verbose output
npm test -- --verbose

# Run only changed tests
npm test -- --onlyChanged
```

## 📊 Test Reports and Coverage

### Coverage Reports
- **HTML Report**: `coverage/lcov-report/index.html`
- **JSON Report**: `coverage/coverage-final.json`
- **LCOV Report**: `coverage/lcov.info`

### Test Results
- **JUnit XML**: `test-results/junit.xml`
- **HTML Report**: `test-results/test-report.html`
- **JSON Results**: `test-results.json`

### Performance Reports
- **Benchmark Results**: `benchmark-results.json`
- **Performance Report**: `performance-report.json`

## 🎯 Performance Thresholds

| Operation | Threshold | Baseline |
|-----------|-----------|----------|
| PDF Load (Small) | < 2s | 1.5s |
| PDF Load (Large) | < 5s | 3.8s |
| Page Render | < 500ms | 300ms |
| Merge (2 files) | < 3s | 2s |
| Split (10 pages) | < 2s | 1.2s |
| Memory Usage (Idle) | < 100MB | 80MB |
| Memory Usage (Processing) | < 200MB | 150MB |

## ♿ Accessibility Standards

The test suite validates compliance with:
- **WCAG 2.1 AA** guidelines
- **iOS Accessibility** guidelines
- **Android Accessibility** guidelines
- **React Native Accessibility** best practices

### Accessibility Test Coverage
- Screen reader compatibility
- Touch target sizes (minimum 44x44 points)
- Color contrast ratios
- Focus management
- Haptic feedback
- Voice control support

## 🔄 Continuous Integration

### GitHub Actions Workflow
The comprehensive test suite runs automatically on:
- **Push** to main/develop branches
- **Pull Requests** to main/develop branches
- **Scheduled runs** (daily for performance tests)

### Test Pipeline Stages
1. **Unit & Integration Tests** (parallel)
2. **End-to-End Tests** (sequential)
3. **Performance Tests** (on schedule or manual trigger)
4. **Cross-Platform Tests** (iOS and Android)
5. **Accessibility Tests** (parallel)
6. **Security & Quality Checks**
7. **Report Generation & Notification**

## 📝 Test Data Management

### Mock Data Generation
The `TestDataManager` class provides:
- Mock PDF files of various sizes
- Sample document metadata
- Performance test scenarios
- Error test cases
- Accessibility test scenarios

### Test Environment Setup
- Mocked external dependencies (Expo modules, React Native APIs)
- Simulated file system operations
- Mock network conditions
- Accessibility setting simulation

## 🐛 Debugging Tests

### Common Issues and Solutions

1. **Test Timeouts**
   ```bash
   # Increase timeout for specific tests
   npm test -- --testTimeout=60000
   ```

2. **Memory Issues**
   ```bash
   # Run tests with increased memory
   node --max-old-space-size=4096 node_modules/.bin/jest
   ```

3. **Mock Issues**
   ```bash
   # Clear Jest cache
   npm test -- --clearCache
   ```

4. **Platform-Specific Issues**
   ```bash
   # Run tests for specific platform
   PLATFORM=ios npm run test:cross-platform
   ```

### Debug Mode
```bash
# Run tests in debug mode
node --inspect-brk node_modules/.bin/jest --runInBand
```

## 📈 Test Metrics and KPIs

### Quality Metrics
- **Code Coverage**: Target 80%+ (statements, branches, functions, lines)
- **Test Success Rate**: Target 95%+
- **Performance Regression**: < 10% degradation
- **Accessibility Compliance**: 100% WCAG 2.1 AA

### Performance KPIs
- **Test Execution Time**: < 10 minutes for full suite
- **Memory Usage**: < 2GB during test execution
- **CPU Usage**: < 80% average during tests
- **Flaky Test Rate**: < 2%

## 🔧 Configuration

### Jest Configuration
- **Config File**: `jest.config.js`
- **Setup File**: `src/__tests__/setup.ts`
- **Mock Directory**: `src/__tests__/__mocks__/`

### Test Pipeline Configuration
- **Config File**: `src/__tests__/pipeline/test-pipeline.config.ts`
- **Runner**: `src/__tests__/run-comprehensive-tests.ts`

## 📚 Best Practices

### Writing Tests
1. **Follow AAA Pattern**: Arrange, Act, Assert
2. **Use Descriptive Names**: Test names should explain what is being tested
3. **Mock External Dependencies**: Keep tests isolated and fast
4. **Test Edge Cases**: Include error conditions and boundary values
5. **Maintain Test Data**: Use the TestDataManager for consistent test data

### Performance Testing
1. **Set Realistic Thresholds**: Based on actual device capabilities
2. **Measure Multiple Runs**: Average results over multiple executions
3. **Monitor Memory Usage**: Track memory leaks and cleanup
4. **Test on Different Devices**: Validate performance across device types

### Accessibility Testing
1. **Test with Screen Readers**: Validate actual screen reader experience
2. **Check Touch Targets**: Ensure minimum 44x44 point touch targets
3. **Validate Focus Order**: Test keyboard and screen reader navigation
4. **Test Color Contrast**: Ensure sufficient contrast ratios

## 🤝 Contributing

When adding new tests:
1. Follow the existing test structure and naming conventions
2. Add appropriate test data to the TestDataManager
3. Update performance thresholds if needed
4. Ensure tests are deterministic and not flaky
5. Add documentation for complex test scenarios

## 📞 Support

For questions about the test suite:
- Check existing test examples in each category
- Review the TestDataManager for mock data patterns
- Consult the Jest documentation for advanced features
- Check the GitHub Actions workflow for CI/CD setup