# Unit Testing Guide - TrackNGo Project

## Frontend Testing (Jest)

### Setup

1. **Install Jest and related dependencies:**
```bash
cd frontend/driverapp
npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event ts-jest @types/jest babel-jest
```

2. **Create Jest configuration file** (`jest.config.js` in driverapp root):
```javascript
export default {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/index.tsx',
  ],
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
};
```

3. **Create setup file** (`src/setupTests.ts`):
```typescript
import '@testing-library/jest-dom';
```

4. **Update package.json scripts:**
```json
"scripts": {
  "start": "expo start",
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage"
}
```

### Running Frontend Tests

```bash
# Run tests once
npm test

# Run tests in watch mode (auto-rerun on changes)
npm run test:watch

# Generate coverage report
npm run test:coverage
```

**Test results location:** `coverage/` directory (created in driverapp root)

---

## Backend Testing (JUnit 5 + Mockito)

### Current Setup
Your backend already has testing dependencies configured. Ensure your module pom.xml includes:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-test</artifactId>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.mockito</groupId>
    <artifactId>mockito-core</artifactId>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.mockito</groupId>
    <artifactId>mockito-junit-jupiter</artifactId>
    <scope>test</scope>
</dependency>
```

### Add Test Reporting Configuration

Add to your **parent pom.xml** to generate test reports:

```xml
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-surefire-plugin</artifactId>
    <version>3.0.0-M9</version>
    <configuration>
        <reportFormat>plain</reportFormat>
        <reportFormat>xml</reportFormat>
    </configuration>
</plugin>

<plugin>
    <groupId>org.jacoco</groupId>
    <artifactId>jacoco-maven-plugin</artifactId>
    <version>0.8.10</version>
    <executions>
        <execution>
            <goals>
                <goal>prepare-agent</goal>
            </goals>
        </execution>
        <execution>
            <id>report</id>
            <phase>test</phase>
            <goals>
                <goal>report</goal>
            </goals>
        </execution>
    </executions>
</plugin>
```

### Running Backend Tests

```bash
cd backend/trackngo-backend

# Run all tests
mvn test

# Run tests for specific module
mvn test -pl driver-module

# Run tests with coverage report
mvn clean test jacoco:report

# Run specific test class
mvn -Dtest=DriverServiceImplTest test

# Run specific test method
mvn -Dtest=DriverServiceImplTest#testFindDriverById test
```

**Test results location:** `target/surefire-reports/` (XML and TXT reports)
**Coverage report location:** `target/site/jacoco/` (open `index.html` in browser)

---

## Example Unit Tests

### Frontend Example (React Component Test)

Create `src/components/__tests__/LoginButton.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import LoginButton from '../LoginButton';

describe('LoginButton', () => {
  it('renders button with correct text', () => {
    render(<LoginButton />);
    expect(screen.getByText('Login')).toBeInTheDocument();
  });

  it('calls onClick handler when clicked', () => {
    const handleClick = jest.fn();
    render(<LoginButton onClick={handleClick} />);
    fireEvent.click(screen.getByText('Login'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Backend Example (Service Test with Mockito)

Create `DriverServiceImplTest.java`:

```java
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

class DriverServiceImplTest {
    
    private DriverServiceImpl driverService;
    
    @Mock
    private DriverRepository driverRepository;
    
    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        driverService = new DriverServiceImpl(driverRepository);
    }
    
    @Test
    void testFindDriverById() {
        // Arrange
        Long driverId = 1L;
        Driver driver = new Driver();
        driver.setId(driverId);
        driver.setName("John Doe");
        when(driverRepository.findById(driverId)).thenReturn(Optional.of(driver));
        
        // Act
        Driver result = driverService.findById(driverId);
        
        // Assert
        assertNotNull(result);
        assertEquals("John Doe", result.getName());
        verify(driverRepository, times(1)).findById(driverId);
    }
}
```

---

## Saving & Viewing Test Results

### Frontend (Jest)
- **Coverage HTML Report:** After running `npm run test:coverage`, open `coverage/lcov-report/index.html`
- **JUnit XML Report:** Add to jest.config.js:
```javascript
reporters: [
  'default',
  ['jest-junit', {
    outputDirectory: './test-results',
    outputName: 'junit.xml',
  }],
],
```

### Backend (Maven)
- **Surefire Reports:** `target/surefire-reports/` (XML format)
- **JaCoCo Coverage:** `target/site/jacoco/index.html` (open in browser)
- **Generate HTML Test Report:** 
```bash
mvn surefire-report:report
# Open target/site/surefire-report.html
```

---

## CI/CD Integration (Optional)

### GitHub Actions Example
Create `.github/workflows/tests.yml`:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: cd frontend/driverapp && npm install && npm test

  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-java@v2
        with:
          java-version: '21'
      - run: cd backend/trackngo-backend && mvn clean test
```

---

## Best Practices

✅ **Do:**
- Test one thing per test case
- Use meaningful test names (describe what should happen)
- Mock external dependencies
- Aim for 70-80% code coverage
- Keep tests simple and readable

❌ **Avoid:**
- Testing implementation details
- Creating dependencies between tests
- Hard-coding data (use fixtures/builders)
- Ignoring failing tests
- Over-mocking everything

