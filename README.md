# Student Attendance and Academic Performance Management System Using DevOps Tools

A complete, production-ready web application designed for engineering colleges to manage student records, daily 7-period attendance, monthly attendance reports, defaulter identification (<75%), internal assessment marks, and combined academic performance.

The project incorporates modern DevOps tools and practices across the entire software development lifecycle: **Git, GitHub, Jenkins CI/CD, Docker Containerization, Kubernetes Orchestration, and automated Selenium WebDriver Testing (Java 17/25, Maven, JUnit 5)**.

---

## 1. Technology Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (No React, Next.js, or complex frameworks; clean modular design).
- **Backend:** Node.js, Express.js (RESTful APIs with session authentication middleware).
- **Database:** SQLite3 (`database/attendance.db`) with Foreign Keys, Cascades, and UPSERT constraints.
- **Security:** Faculty session tokens, bcrypt password hashing, HTTP-only session cookies and Bearer tokens.
- **Testing:** Java 17/25, Maven 3.9.9, JUnit 5, Selenium WebDriver 4.25.0, Google Chrome (Headless).
- **Containerization:** Docker & Docker Compose (`Dockerfile`, `docker-compose.yml`).
- **Continuous Integration (CI):** Jenkins Declarative Pipeline (`Jenkinsfile`).
- **Container Orchestration:** Kubernetes (`k8s/pvc.yaml`, `k8s/deployment.yaml`, `k8s/service.yaml`).

---

## 2. Directory Structure

```text
Student-Attendance-DevOps/
│
├── database/
│   ├── attendance.db          # Auto-generated SQLite persistent database
│   └── db.js                  # Database initialization, schemas & connection pool
│
├── public/                    # Client-side frontend assets (Vanilla JS / HTML / CSS)
│   ├── login.html             # Faculty authentication interface
│   ├── index.html             # Real-time System Dashboard & Defaulter Overview
│   ├── students.html          # Student Registration, Roster Search & Soft Delete
│   ├── attendance.html        # Daily Attendance Sheet (7 Periods P1-P7)
│   ├── report.html            # Monthly Summary, Defaulters, Combined Report & CSV Export
│   ├── marks.html             # Internal Marks Management & Validation
│   ├── style.css              # Custom styling matching project specifications
│   ├── auth.js                # Session validation, navbar state & logout
│   ├── script.js              # Dashboard metrics & defaulter notifications
│   ├── students.js            # Student CRUD & search filtering logic
│   ├── attendance.js          # Period toggle & bulk attendance save logic
│   ├── report.js              # Monthly calculation, combined modal & CSV download
│   └── marks.js               # Marks CRUD, percentage calculation & validations
│
├── k8s/                       # Kubernetes deployment manifests
│   ├── pvc.yaml               # PersistentVolumeClaim for SQLite database storage
│   ├── deployment.yaml        # Deployment specification with health probes
│   └── service.yaml           # NodePort Service (Port 30080)
│
├── tests/
│   └── selenium-test.js       # Node.js automated suite (10 required test cases)
│
├── selenium-tests/            # Java Maven Selenium Test Suite (10 Required Test Cases)
│   ├── pom.xml                # Maven configuration with Selenium Java & JUnit 5
│   └── src/test/java/tests/
│       ├── BaseTest.java                      # Chrome headless setup & shared test helpers
│       └── AttendanceSystemSeleniumTests.java # Exactly the 10 Necessary Test Cases (TC01 - TC10)
│
├── Dockerfile                 # Production multi-stage Docker build
├── .dockerignore              # Docker build exclusions
├── docker-compose.yml         # Container orchestration with volume persistence
├── Jenkinsfile                # Jenkins CI pipeline stages
├── server.js                  # Express backend application server & REST APIs
├── seed.js                    # Sample data seeding script (10 students, 1540+ period records)
├── package.json               # Project dependencies and script shortcuts
├── TEST_CASE_EXECUTION.md     # Complete 27-test individual execution commands
└── README.md                  # Comprehensive project documentation
```

---

## 3. Database Schema

The SQLite database (`database/attendance.db`) is automatically initialized upon server start:

### 1. `faculty` Table
```sql
CREATE TABLE IF NOT EXISTS faculty (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2. `faculty_sessions` Table
```sql
CREATE TABLE IF NOT EXISTS faculty_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  faculty_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE CASCADE
);
```

### 3. `students` Table (with Soft Delete Support)
```sql
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  roll_no TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 4. `attendance` Table (with UPSERT Constraint)
```sql
CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  attendance_date TEXT NOT NULL,
  period INTEGER NOT NULL CHECK (period BETWEEN 1 AND 7),
  status TEXT NOT NULL CHECK (status IN ('Present', 'Absent')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  UNIQUE (student_id, attendance_date, period)
);
```

### 5. `internal_marks` Table
```sql
CREATE TABLE IF NOT EXISTS internal_marks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  subject TEXT NOT NULL,
  assessment_name TEXT NOT NULL,
  marks_obtained REAL NOT NULL CHECK (marks_obtained >= 0),
  max_marks REAL NOT NULL CHECK (max_marks > 0),
  marks_percentage REAL GENERATED ALWAYS AS (ROUND((marks_obtained / max_marks) * 100.0, 2)) STORED,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);
```

---

## 4. Backend REST APIs

| Module | Method | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/auth/login` | Authenticate faculty and generate secure session |
| **Auth** | `POST` | `/api/auth/logout` | Terminate session and invalidate cookie/token |
| **Auth** | `GET` | `/api/auth/me` | Fetch currently logged-in faculty details |
| **Students** | `GET` | `/api/students` | List active students (ordered by roll number) |
| **Students** | `POST` | `/api/students` | Register student (validates unique roll number) |
| **Students** | `PUT` | `/api/students/:id` | Update student name, roll number, or department |
| **Students** | `DELETE` | `/api/students/:id` | Soft delete (`is_active = 0`), preserving history |
| **Attendance** | `GET` | `/api/attendance/:date` | Get 7 period records for date |
| **Attendance** | `POST` | `/api/attendance` | Bulk save/upsert attendance (prevents duplicates) |
| **Reports** | `GET` | `/api/report/monthly` | Calculate working periods, attendance % & defaulters |
| **Reports** | `GET` | `/api/report/student/:id` | Individual student summary & 7-period daily history |
| **Reports** | `GET` | `/api/report/monthly/export` | Download monthly report as RFC 4180 CSV file |
| **Marks** | `GET` | `/api/marks` | List all internal marks records |
| **Marks** | `POST` | `/api/marks` | Record new internal assessment marks |
| **Marks** | `PUT` | `/api/marks/:id` | Update assessment marks score |
| **Marks** | `DELETE` | `/api/marks/:id` | Delete an internal mark entry |
| **Academics** | `GET` | `/api/report/academic/:id` | Combined report with attendance + internal marks |
| **Dashboard** | `GET` | `/api/dashboard` | Real-time statistics, today counts, defaulters list |

---

## 5. Local Setup & Execution

### 1. Install Node.js Dependencies
```powershell
npm install
```

### 2. Seed Database
Seeds 10 sample students, faculty account (`faculty` / `password123`), 1540+ period attendance records for October 2026, and internal marks:
```powershell
node seed.js
```

### 3. Start Application
```powershell
node server.js
```
Open your browser and navigate to:
```text
http://localhost:3000
```
Login with:
- **Username:** `faculty`
- **Password:** `password123`

---

## 6. Automated Testing (Selenium WebDriver)

The project includes **EXACTLY the 10 Necessary Test Cases (TC01 - TC10)** strictly defined in the project specification and syllabus.

### Run All 10 Test Cases via Maven (Java JUnit 5):
```powershell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-25"; & "C:\Users\amith\maven\apache-maven-3.9.9\bin\mvn.cmd" -f selenium-tests/pom.xml test
```

### Run All 10 Test Cases via NPM (JavaScript / Jenkins CI Pipeline):
```powershell
npm run test:selenium
```

### The 10 Necessary Test Cases:
1. **TC01:** Verify attendance page displays all registered students.
2. **TC02:** Verify attendance can be marked for all seven periods (P1 to P7).
3. **TC03:** Verify attendance is saved successfully for a selected date.
4. **TC04:** Verify missing or invalid student information and duplicate roll numbers are handled.
5. **TC05:** Verify duplicate attendance entries are prevented (UPSERT / UNIQUE constraint).
6. **TC06:** Verify monthly attendance totals are calculated correctly (`Working = Present + Absent`).
7. **TC07:** Verify attendance percentage is displayed correctly: `(Present / Working) * 100`.
8. **TC08:** Verify students below the configured attendance threshold (<75%) are identified.
9. **TC09:** Verify monthly report can be generated and exported as CSV.
10. **TC10:** Verify saved records remain available and persistent in SQLite database.

### Run Individual Test Case:
Every test case is independently executable. Example:
```powershell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-25"; & "C:\Users\amith\maven\apache-maven-3.9.9\bin\mvn.cmd" -f selenium-tests/pom.xml -Dtest=AttendanceSystemSeleniumTests#TC01_attendancePageDisplaysRegisteredStudents test
```
See [`TEST_CASE_EXECUTION.md`](file:///c:/Users/amith/Desktop/Student%20Attendance/TEST_CASE_EXECUTION.md) for individual commands for all 10 test cases.

---

## 7. DevOps Pipeline & Configurations

### Phase 2: Git & GitHub
```powershell
git init
git add .
git commit -m "Complete Student Attendance & Academic Performance System"
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/Student-Attendance-DevOps.git
git push -u origin main
```

### Phase 3: Docker Containerization
```powershell
# Build image
docker build -t student-attendance-devops:latest .

# Run with persistent volume
docker run -d -p 3000:3000 --name student_attendance -v ${PWD}/database:/app/database student-attendance-devops:latest

# Or using Docker Compose
docker compose up -d
```

### Phase 4: Jenkins CI Pipeline
The declarative pipeline in `Jenkinsfile` automates:
1. SCM Checkout
2. Node dependency installation
3. Syntax verification and seed script execution
4. Production Docker build and tagging
5. Container health check on port 3001
6. Automated Selenium test execution

### Phase 5: Kubernetes Orchestration
```powershell
kubectl apply -f k8s/pvc.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml

# Verify deployment
kubectl get pods -l app=student-attendance
kubectl get svc student-attendance-service
```
Access via NodePort at `http://localhost:30080`.
