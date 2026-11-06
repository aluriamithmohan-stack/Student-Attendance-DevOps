# Test Case Execution Guide & Verification Report

**Student Attendance Management System Using DevOps Tools**

This document details the **10 Necessary Automated Test Cases (TC01 - TC10)** strictly defined in the project specification and syllabus. The test suite is implemented in both **Java (JUnit 5, Maven Surefire, Selenium WebDriver)** and **JavaScript (Node.js Selenium WebDriver)** running in Headless Google Chrome.

---

## 1. Prerequisites & Application Startup

Before running the Selenium test suite, ensure the Node.js backend application is running on port 3000:

```powershell
# 1. Install dependencies
npm install

# 2. Seed database with faculty, sample students, and October 2026 attendance
node seed.js

# 3. Start application server
node server.js
```

Application URL: `http://localhost:3000`  
Default Faculty Credentials: `faculty` / `password123`

---

## 2. Execute All 10 Necessary Test Cases

### Option A: Via Maven (Java JUnit 5 Selenium Suite)
```powershell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-25"; & "C:\Users\amith\maven\apache-maven-3.9.9\bin\mvn.cmd" -f selenium-tests/pom.xml test
```

### Option B: Via NPM / Jenkins CI Pipeline
```powershell
npm run test:selenium
```

### Execution Results:
```text
[INFO] -------------------------------------------------------
[INFO]  T E S T S
[INFO] -------------------------------------------------------
[INFO] Running tests.AttendanceSystemSeleniumTests
[INFO] Tests run: 10, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 25.13 s -- in tests.AttendanceSystemSeleniumTests
[INFO] 
[INFO] Results:
[INFO] 
[INFO] Tests run: 10, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
```

---

## 3. The 10 Necessary Test Cases & Individual Execution Commands

Every test case can be executed completely independently without dependencies on any other test case:

| Test ID | Test Case Description | Execution Command (Java Maven) | Status |
| :---: | :--- | :--- | :---: |
| **TC01** | Verify attendance page displays all registered students | `$env:JAVA_HOME = "C:\Program Files\Java\jdk-25"; & "C:\Users\amith\maven\apache-maven-3.9.9\bin\mvn.cmd" -f selenium-tests/pom.xml -Dtest=AttendanceSystemSeleniumTests#TC01_attendancePageDisplaysRegisteredStudents test` | **PASSED** |
| **TC02** | Verify attendance can be marked for all seven periods (P1 to P7) | `$env:JAVA_HOME = "C:\Program Files\Java\jdk-25"; & "C:\Users\amith\maven\apache-maven-3.9.9\bin\mvn.cmd" -f selenium-tests/pom.xml -Dtest=AttendanceSystemSeleniumTests#TC02_markAttendanceForAllSevenPeriods test` | **PASSED** |
| **TC03** | Verify attendance is saved successfully for a selected date | `$env:JAVA_HOME = "C:\Program Files\Java\jdk-25"; & "C:\Users\amith\maven\apache-maven-3.9.9\bin\mvn.cmd" -f selenium-tests/pom.xml -Dtest=AttendanceSystemSeleniumTests#TC03_saveAttendanceForSelectedDate test` | **PASSED** |
| **TC04** | Verify missing or invalid student information and duplicate roll numbers are handled | `$env:JAVA_HOME = "C:\Program Files\Java\jdk-25"; & "C:\Users\amith\maven\apache-maven-3.9.9\bin\mvn.cmd" -f selenium-tests/pom.xml -Dtest=AttendanceSystemSeleniumTests#TC04_handleInvalidStudentInformationAndDuplicateRoll test` | **PASSED** |
| **TC05** | Verify duplicate attendance entries are prevented (UPSERT / UNIQUE constraint) | `$env:JAVA_HOME = "C:\Program Files\Java\jdk-25"; & "C:\Users\amith\maven\apache-maven-3.9.9\bin\mvn.cmd" -f selenium-tests/pom.xml -Dtest=AttendanceSystemSeleniumTests#TC05_preventDuplicateAttendanceEntries test` | **PASSED** |
| **TC06** | Verify monthly attendance totals are calculated correctly (`Working = Present + Absent`) | `$env:JAVA_HOME = "C:\Program Files\Java\jdk-25"; & "C:\Users\amith\maven\apache-maven-3.9.9\bin\mvn.cmd" -f selenium-tests/pom.xml -Dtest=AttendanceSystemSeleniumTests#TC06_monthlyAttendanceTotalsCalculation test` | **PASSED** |
| **TC07** | Verify attendance percentage is displayed correctly: `(Present / Working) * 100` | `$env:JAVA_HOME = "C:\Program Files\Java\jdk-25"; & "C:\Users\amith\maven\apache-maven-3.9.9\bin\mvn.cmd" -f selenium-tests/pom.xml -Dtest=AttendanceSystemSeleniumTests#TC07_attendancePercentageCalculation test` | **PASSED** |
| **TC08** | Verify students below the configured attendance threshold (<75%) are identified | `$env:JAVA_HOME = "C:\Program Files\Java\jdk-25"; & "C:\Users\amith\maven\apache-maven-3.9.9\bin\mvn.cmd" -f selenium-tests/pom.xml -Dtest=AttendanceSystemSeleniumTests#TC08_studentsBelowAttendanceThresholdIdentified test` | **PASSED** |
| **TC09** | Verify monthly report can be generated and exported as CSV | `$env:JAVA_HOME = "C:\Program Files\Java\jdk-25"; & "C:\Users\amith\maven\apache-maven-3.9.9\bin\mvn.cmd" -f selenium-tests/pom.xml -Dtest=AttendanceSystemSeleniumTests#TC09_monthlyReportCanBeGeneratedAndExported test` | **PASSED** |
| **TC10** | Verify saved records remain available and persistent in SQLite database | `$env:JAVA_HOME = "C:\Program Files\Java\jdk-25"; & "C:\Users\amith\maven\apache-maven-3.9.9\bin\mvn.cmd" -f selenium-tests/pom.xml -Dtest=AttendanceSystemSeleniumTests#TC10_savedRecordsRemainAvailableAfterRestart test` | **PASSED** |

---

## 4. Test Structure

```text
selenium-tests/
├── pom.xml
└── src/test/java/tests/
    ├── BaseTest.java                      # Shared headless Chrome driver & helpers
    └── AttendanceSystemSeleniumTests.java # Exactly the 10 Necessary Test Cases (TC01 - TC10)
```
