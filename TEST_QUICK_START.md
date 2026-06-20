# Unit Testing Quick Start - TrackNGo

## 🚀 Quick Setup (5 minutes)

### Backend Setup (JUnit 5 + Mockito)

Already configured in your `pom.xml` files. Just run:

```bash
# From TrackNGo/backend/trackngo-backend directory
mvn clean test
```

### Frontend Setup (Jest)

1. Install dependencies:
```bash
cd frontend/driverapp
npm install
```

2. Run tests:
```bash
npm test
```

---

## 📊 Running Tests

### Backend

```bash
# Run all backend tests
cd backend/trackngo-backend
mvn test

# Run specific module tests
mvn test -pl driver-module

# Run single test class
mvn -Dtest=DriverServiceImplTest test

# Run single test method
mvn -Dtest=DriverServiceImplTest#testFindDriverById_Success test

# Generate test reports
mvn clean test jacoco:report

# View coverage report
# Open: backend/trackngo-backend/driver-module/target/site/jacoco/index.html
```

### Frontend

```bash
cd frontend/driverapp

# Run all tests (one-time)
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Generate coverage report
npm run test:coverage

# View coverage report
# Open: frontend/driverapp/coverage/lcov-report/index.html
```

---

## 📍 Test Results Locations

### Backend
- **Test Reports (XML):** `driver-module/target/surefire-reports/`
- **Test Report (HTML):** Run `mvn surefire-report:report` → `target/site/surefire-report.html`
- **Coverage Report:** `driver-module/target/site/jacoco/index.html`

### Frontend
- **Coverage Report:** `frontend/driverapp/coverage/`
- **JUnit XML:** `frontend/driverapp/test-results/junit.xml`

---

## ✍️ Writing Tests

### Backend Example (Mockito + JUnit 5)

Create test file: `src/test/java/com/trackngo/driver/internal/service/DriverServiceImplTest.java`

```java
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Driver Service Tests")
class DriverServiceImplTest {
    
    @Mock
    private DriverRepository driverRepository;
    
    private DriverServiceImpl driverService;
    
    @Test
    @DisplayName("Should find driver by ID")
    void testFindDriverById() {
        // Arrange - set up test data
        Driver driver = new Driver();
        driver.setId(1L);
        driver.setName("John Doe");
        when(driverRepository.findById(1L)).thenReturn(Optional.of(driver));
        
        driverService = new DriverServiceImpl(driverRepository);
        
        // Act - execute method
        Driver result = driverService.findById(1L);
        
        // Assert - verify results
        assertNotNull(result);
        assertEquals("John Doe", result.getName());
        verify(driverRepository, times(1)).findById(1L);
    }
}
```

### Frontend Example (Jest + React Testing Library)

Create test file: `src/components/__tests__/LoginForm.test.tsx`

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import LoginForm from '../LoginForm';

describe('LoginForm Component', () => {
  it('should render login form', () => {
    render(<LoginForm />);
    expect(screen.getByText('Login')).toBeInTheDocument();
  });

  it('should validate email field', async () => {
    render(<LoginForm />);
    const emailInput = screen.getByPlaceholderText('Email');
    
    fireEvent.change(emailInput, { target: { value: 'invalid' } });
    fireEvent.blur(emailInput);
    
    expect(screen.getByText('Invalid email')).toBeInTheDocument();
  });

  it('should submit form with valid data', async () => {
    const mockSubmit = jest.fn();
    render(<LoginForm onSubmit={mockSubmit} />);
    
    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: 'test@example.com' }
    });
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'password123' }
    });
    fireEvent.click(screen.getByText('Login'));
    
    expect(mockSubmit).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123'
    });
  });
});
```

---

## 📈 Coverage Goals

| Module | Target Coverage |
|--------|-----------------|
| Business Logic | 80%+ |
| Controllers/UI | 60%+ |
| Utilities | 90%+ |
| Integration | Not required for unit tests |

---

## 🛠️ Common Commands

```bash
# Backend - all modules
mvn clean test

# Backend - one module with coverage
mvn clean test jacoco:report -pl driver-module

# Backend - skip tests (if needed)
mvn clean install -DskipTests

# Frontend - watch mode (great for TDD)
cd frontend/driverapp && npm run test:watch

# Frontend - coverage only
cd frontend/driverapp && npm run test:coverage
```

---

## 📚 Best Practices

✅ **Do:**
- Test one thing per test
- Use descriptive test names (`testFindDriverById_WhenIdExists_ReturnsDriver`)
- Mock external dependencies
- Use Arrange-Act-Assert pattern
- Test edge cases and error scenarios

❌ **Avoid:**
- Testing implementation details
- Complex test logic
- Shared state between tests
- Hardcoded test data (use builders)
- Ignoring test failures

---

## 🔍 Viewing Reports

### Backend Coverage
```bash
cd backend/trackngo-backend/driver-module
mvn clean test jacoco:report
# Open target/site/jacoco/index.html in browser
```

### Frontend Coverage
```bash
cd frontend/driverapp
npm run test:coverage
# Open coverage/lcov-report/index.html in browser
```

---

## 🐛 Troubleshooting

### Backend: "No tests found"
```bash
# Ensure test file follows naming pattern: *Test.java
# File should be in: src/test/java/...
mvn -Dtest=YourTestClass test
```

### Frontend: "Cannot find module"
```bash
cd frontend/driverapp
npm install
# Clear cache
rm -rf node_modules/.cache
npm test
```

### Mockito: "Annotations not working"
Ensure `@ExtendWith(MockitoExtension.class)` is on test class.

---

## 📞 Need Help?

- Backend: [JUnit 5 Docs](https://junit.org/junit5/docs/current/user-guide/)
- Backend: [Mockito Docs](https://javadoc.io/doc/org.mockito/mockito-core/latest/org/mockito/Mockito.html)
- Frontend: [Jest Docs](https://jestjs.io/docs/getting-started)
- Frontend: [RTL Docs](https://testing-library.com/docs/react-testing-library/intro/)

