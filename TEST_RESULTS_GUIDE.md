# Test Results & Reports Guide

## 📁 Test Results Storage Locations

### Backend (Maven/JUnit 5)

```
backend/trackngo-backend/
├── driver-module/
│   └── target/
│       ├── surefire-reports/          ← Test execution reports (XML & TXT)
│       │   ├── TEST-DriverServiceImplTest.xml
│       │   ├── TEST-DriverServiceImplTest.txt
│       │   └── ...
│       └── site/
│           └── jacoco/
│               ├── index.html          ← Coverage report (open in browser)
│               ├── jacoco-sessions.html
│               └── ...
```

### Frontend (Jest)

```
frontend/driverapp/
├── coverage/                           ← Coverage report
│   ├── lcov-report/
│   │   ├── index.html                 ← Open in browser
│   │   └── ...
│   ├── lcov.info                      ← LCOV format (for CI/CD)
│   └── coverage-summary.json
├── test-results/                       ← JUnit XML format
│   └── junit.xml                      ← For CI/CD pipelines
└── [test output in console]
```

---

## 📊 Understanding Test Reports

### Backend: Surefire Test Report

#### XML Format (`target/surefire-reports/TEST-*.xml`)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="DriverServiceImplTest" 
           tests="5" 
           failures="0" 
           errors="0" 
           skipped="0" 
           time="1.234">
  <testcase name="testFindDriverById_Success" 
            classname="com.trackngo.driver.internal.service.DriverServiceImplTest" 
            time="0.123"/>
  <testcase name="testFindDriverById_NotFound" 
            classname="com.trackngo.driver.internal.service.DriverServiceImplTest" 
            time="0.456">
    <failure message="Expected exception not thrown"/>
  </testcase>
</testsuite>
```

**Key Metrics:**
- `tests`: Total number of tests
- `failures`: Failed assertions
- `errors`: Unexpected exceptions
- `skipped`: Marked with @Disabled or similar
- `time`: Execution time in seconds

#### TXT Format (Human Readable)
```
Running com.trackngo.driver.internal.service.DriverServiceImplTest
Tests run: 5, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.234 s <<<< SUCCESS
```

### Backend: JaCoCo Coverage Report

Open `target/site/jacoco/index.html` in browser:

```
Package: com.trackngo.driver
├── Missed Instructions: 45
├── Covered Instructions: 855
├── Coverage: 95%
│
└── Class: DriverServiceImpl
    ├── Methods: 12 (11 covered, 1 missed)
    ├── Lines: 47 (45 covered, 2 missed)
    └── Coverage: 95.7%
```

**Coverage Types:**
- **Line Coverage**: % of code lines executed
- **Branch Coverage**: % of conditional branches tested
- **Method Coverage**: % of methods called by tests
- **Instruction Coverage**: % of bytecode instructions executed (most accurate)

### Frontend: Jest Coverage Report

Open `coverage/lcov-report/index.html`:

```
File          │ % Stmts │ % Branch │ % Funcs │ % Lines │
─────────────────────────────────────────────────────────
All files     │  78.5   │  72.1    │  81.2   │  79.0   │
 components/  │  85.0   │  80.0    │  90.0   │  85.5   │
  Button.tsx  │  95.0   │  100     │  100    │  95.0   │
```

**Metrics Explained:**
- **% Stmts**: Statement coverage (basic lines)
- **% Branch**: Conditional branch coverage (if/else, ternary)
- **% Funcs**: Function/method coverage
- **% Lines**: Line coverage (actual code lines)

---

## 🎯 Running & Saving Reports

### Backend

#### 1. Run Tests and Generate All Reports
```bash
cd backend/trackngo-backend
mvn clean test jacoco:report
```

#### 2. Generate HTML Surefire Report
```bash
mvn surefire-report:report
# Opens: target/site/surefire-report.html
```

#### 3. Save Reports to Archive (for CI/CD)
```bash
# Create timestamped backup
mkdir -p test-reports
cp -r driver-module/target/surefire-reports test-reports/$(date +%Y%m%d_%H%M%S)
cp -r driver-module/target/site/jacoco test-reports/$(date +%Y%m%d_%H%M%S)/coverage
```

### Frontend

#### 1. Generate Coverage Report
```bash
cd frontend/driverapp
npm run test:coverage
```

#### 2. Generate JUnit XML (for CI/CD)
```bash
npm test -- --forceExit
# Creates: test-results/junit.xml
```

#### 3. Generate and Archive
```bash
npm run test:coverage
mkdir -p ../../test-reports/frontend
cp -r coverage/lcov-report ../../test-reports/frontend/$(date +%Y%m%d_%H%M%S)
```

---

## 📈 CI/CD Integration - Saving Results

### GitHub Actions Example

Create `.github/workflows/test-reports.yml`:

```yaml
name: Test Reports

on: [push, pull_request]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Java
        uses: actions/setup-java@v3
        with:
          java-version: '21'
      
      - name: Run backend tests
        run: |
          cd backend/trackngo-backend
          mvn clean test jacoco:report
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./backend/trackngo-backend/driver-module/target/site/jacoco/jacoco.xml
          flags: backend
      
      - name: Archive test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: backend-test-reports
          path: |
            backend/trackngo-backend/*/target/surefire-reports/
            backend/trackngo-backend/*/target/site/jacoco/

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install and test
        run: |
          cd frontend/driverapp
          npm install
          npm run test:coverage
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./frontend/driverapp/coverage/lcov.info
          flags: frontend
      
      - name: Archive test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: frontend-test-reports
          path: |
            frontend/driverapp/coverage/
            frontend/driverapp/test-results/
```

---

## 📊 Interpreting Coverage Reports

### Good Coverage Levels

| Component | Minimum | Target |
|-----------|---------|--------|
| Utils/Helpers | 90% | 95%+ |
| Services/Logic | 80% | 85%+ |
| Controllers/Components | 70% | 75%+ |
| UI Elements | 60% | 70%+ |

### Understanding Coverage Gaps

**Red highlighting** = Not covered by tests
- Identify untested edge cases
- Add tests for exception handling
- Cover error scenarios

**Yellow highlighting** = Partially covered
- Some branches/conditions missed
- Add tests for if/else paths
- Test error conditions

---

## 🔗 Continuous Integration Example

### Local Workflow

```bash
# 1. Run tests locally
cd backend/trackngo-backend
mvn clean test jacoco:report

# 2. Check coverage
open driver-module/target/site/jacoco/index.html

# 3. Push only if passing
git commit -m "Add unit tests"
git push

# 4. CI/CD automatically:
# ✓ Runs full test suite
# ✓ Generates reports
# ✓ Archives artifacts
# ✓ Posts results to PR
```

---

## 💾 Archiving Test Results

### Backup Strategy

```bash
# Create dated backup
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p archived-results/$TIMESTAMP

# Backend
cp -r backend/trackngo-backend/driver-module/target/surefire-reports \
  archived-results/$TIMESTAMP/backend-tests

cp -r backend/trackngo-backend/driver-module/target/site/jacoco \
  archived-results/$TIMESTAMP/backend-coverage

# Frontend
cp -r frontend/driverapp/coverage \
  archived-results/$TIMESTAMP/frontend-coverage

cp -r frontend/driverapp/test-results \
  archived-results/$TIMESTAMP/frontend-tests

# Archive
tar -czf archived-results-$TIMESTAMP.tar.gz archived-results/$TIMESTAMP
```

---

## 🔍 Quick Commands Reference

```bash
# Backend
mvn test                                    # Run tests
mvn test -pl driver-module                  # Run module tests
mvn clean test jacoco:report                # Run + coverage
mvn surefire-report:report                  # Generate HTML report
mvn -Dtest=TestClass test                   # Run specific test class

# Frontend
npm test                                    # Run tests once
npm run test:watch                          # Watch mode
npm run test:coverage                       # With coverage
npm test -- --testNamePattern="testName"    # Specific test

# View Reports
open backend/trackngo-backend/driver-module/target/site/jacoco/index.html
open frontend/driverapp/coverage/lcov-report/index.html
```

---

## ✅ Quality Checklist

- [ ] All tests passing locally
- [ ] Coverage meets minimum requirements
- [ ] No skipped (@Disabled) tests without reason
- [ ] Test names are descriptive
- [ ] Error messages are helpful
- [ ] Reports generated and archived
- [ ] CI/CD pipeline passing
- [ ] Code review includes test coverage

