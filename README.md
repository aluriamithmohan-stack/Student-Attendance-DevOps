# Student Attendance Management System Using DevOps Tools

A complete, full-stack web application designed for engineering colleges to manage class-wise student attendance across seven daily periods and automatically calculate monthly attendance summaries, defaulter alerts, and CSV exports.

This project implements modern DevOps practices across the entire software development lifecycle: **Git, GitHub, Jenkins, Docker, Kubernetes, and Selenium WebDriver**.

---

## 1. Technology Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (Single-Page Dashboard, Modal Editors, Responsive Tables, Interactive P/A Period Toggles)
- **Backend:** Node.js, Express.js (RESTful APIs with robust error handling)
- **Database:** SQLite3 (`database/attendance.db`) with Foreign Keys, Cascades, and UPSERT constraints
- **Containerization:** Docker & Docker Compose
- **Continuous Integration (CI):** Jenkins Declarative Pipeline (`Jenkinsfile`)
- **Container Orchestration:** Kubernetes (Deployment, NodePort Service, PersistentVolumeClaim)
- **Automated Testing:** Selenium WebDriver (JavaScript, Google Chrome)

---

## 2. Project Directory Structure

```text
Student-Attendance-DevOps/
│
├── database/
│   ├── attendance.db          # Auto-generated SQLite persistent database
│   └── db.js                  # Database initialization, schemas & connection pool
│
├── public/                    # Client-side frontend assets
│   ├── index.html             # Real-time System Dashboard
│   ├── students.html          # Student Registration & Roster Management
│   ├── attendance.html        # Daily Attendance Sheet (7 Periods)
│   ├── report.html            # Monthly Summary, Defaulter Alerts & CSV Export
│   ├── style.css              # Custom styling matching project specifications
│   ├── script.js              # Dashboard metrics & defaulter notifications
│   ├── students.js            # Student CRUD & search filtering logic
│   ├── attendance.js          # Period toggle & bulk attendance save logic
│   └── report.js              # Monthly calculation & CSV generation logic
│
├── k8s/                       # Kubernetes deployment manifests
│   ├── pvc.yaml               # PersistentVolumeClaim for SQLite database storage
│   ├── deployment.yaml        # Deployment specification with health probes
│   └── service.yaml           # NodePort Service (Port 30080)
│
├── tests/
│   └── selenium-test.js       # Automated suite covering all 10 project test cases
│
├── Dockerfile                 # Production multi-stage Docker build
├── .dockerignore              # Docker build exclusions
├── docker-compose.yml         # Container orchestration with volume persistence
├── Jenkinsfile                # Jenkins CI pipeline stages
├── server.js                  # Express backend application server & REST APIs
├── seed.js                    # Sample data seeding script (154 working periods)
├── package.json               # Project dependencies and script shortcuts
├── .gitignore                 # Version control exclusions
└── README.md                  # Comprehensive project documentation
```

---

## 3. Database Schema

The SQLite database (`database/attendance.db`) is automatically created upon starting the server.

### Students Table (`students`)
```sql
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  roll_no TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Attendance Table (`attendance`)
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

> **Constraint Protection:** The composite unique constraint `UNIQUE (student_id, attendance_date, period)` guarantees duplicate records cannot be created for the same student on the same date and period.

---

## 4. Backend REST APIs

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/students` | Get all registered students ordered by roll number |
| `POST` | `/api/students` | Register a new student (validates unique roll number) |
| `PUT` | `/api/students/:id` | Update existing student name, roll number, or department |
| `DELETE` | `/api/students/:id` | Delete a student and cascade delete attendance records |
| `GET` | `/api/attendance/:date` | Retrieve all 7 period records for a specific date |
| `POST` | `/api/attendance` | Bulk save/upsert attendance records inside a transaction |
| `GET` | `/api/report/monthly` | Calculate working periods, attendance % and defaulters |
| `GET` | `/api/report/student/:id` | Fetch individual student summary & daily attendance history |
| `GET` | `/api/dashboard` | Real-time counts, today's status, and low attendance alerts |

---

## 5. Phase 1: Local Execution & Testing

### 1. Install Node.js Dependencies
```bash
npm install
```

### 2. Seed Sample Test Data
Populate 10 students across CSE / AI&ML with 22 working days (154 periods per student) matching project specification preview figures:
```bash
npm run seed
```

### 3. Start Application
```bash
npm start
```
Open your browser and navigate to:
```text
http://localhost:3000
```

---

## 6. Phase 2: Git and GitHub Setup

```bash
# 1. Initialize local repository
git init

# 2. Add files and make initial commit
git add .
git commit -m "Initial commit: Student Attendance Management System with DevOps configs"

# 3. Create a GitHub repository called 'Student-Attendance-DevOps' and link it
git branch -M main
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/Student-Attendance-DevOps.git

# 4. Push to GitHub
git push -u origin main
```

---

## 7. Phase 3: Docker Containerization

### Build Docker Image
```bash
docker build -t student-attendance-devops:latest .
```

### Run Docker Container with Persistent Volume
```bash
docker run -d -p 3000:3000 --name student_attendance -v $(pwd)/database:/app/database student-attendance-devops:latest
```

### Run Using Docker Compose
```bash
docker compose up -d
```
Check container logs and status:
```bash
docker compose ps
docker compose logs -f
```

---

## 8. Phase 4: Jenkins CI Pipeline

The included `Jenkinsfile` defines a 6-stage declarative pipeline:

1. **Checkout SCM:** Clones repository from GitHub.
2. **Install Dependencies:** Executes `npm install`.
3. **Syntax & DB Verification:** Verifies Node syntax (`node -c`) and runs seed script.
4. **Docker Build:** Builds and tags `student-attendance-devops:${BUILD_NUMBER}`.
5. **Container Health Check:** Runs an isolated test container on port 3001 and probes `/api/dashboard`.
6. **Automated Selenium Tests:** Executes end-to-end Selenium tests.

---

## 9. Phase 5: Kubernetes Deployment

Deploy the containerized application to Kubernetes (Minikube, Docker Desktop K8s, or Cloud Cluster):

```bash
# 1. Apply PersistentVolumeClaim
kubectl apply -f k8s/pvc.yaml

# 2. Apply Deployment
kubectl apply -f k8s/deployment.yaml

# 3. Apply NodePort Service
kubectl apply -f k8s/service.yaml

# 4. Check deployment and pod status
kubectl get pods -l app=student-attendance
kubectl get svc student-attendance-service
```

Access the application in your browser:
- **Minikube:** `minikube service student-attendance-service`
- **Docker Desktop / Local Node:** `http://localhost:30080`

---

## 10. Phase 6: Selenium Automated Testing

The automated test suite runs 10 end-to-end test cases covering every functional requirement:

```bash
npm run test:selenium
```

### 10 Automated Test Cases:
1. **TC-1:** Verify attendance page displays registered students.
2. **TC-2:** Verify attendance can be marked and toggled for all seven daily periods (P1 to P7).
3. **TC-3:** Verify attendance records are saved successfully for a selected date.
4. **TC-4:** Verify invalid student data and duplicate roll numbers are rejected with friendly error messages.
5. **TC-5:** Verify duplicate attendance entries for the same student, date, and period are prevented.
6. **TC-6:** Verify monthly attendance calculations (`Working Periods = Present + Absent`).
7. **TC-7:** Verify attendance percentage formula: `(Present / Working Periods) * 100`.
8. **TC-8:** Verify students below the attendance threshold (e.g., 74.68% < 75%) are identified and highlighted.
9. **TC-9:** Verify monthly report table generation and CSV export functionality.
10. **TC-10:** Verify saved attendance records remain persistent across application restarts.
