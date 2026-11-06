const express = require('express');
const path = require('path');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const { db, run, get, all } = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request logger for debugging and audit
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (req.url.startsWith('/api/')) {
      console.log(`[API] ${req.method} ${req.url} -> ${res.statusCode} (${Date.now() - start}ms)`);
    }
  });
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Helper to format date string as YYYY-MM-DD
function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ==========================================
// AUTHENTICATION MIDDLEWARE & HELPERS
// ==========================================

async function getAuthenticatedFaculty(req) {
  // Check cookie or Authorization header (Bearer <token>)
  let token = req.cookies && req.cookies.session_token;
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return null;

  const session = await get(
    `SELECT fs.token, fs.faculty_id, fs.expires_at, f.username, f.name
     FROM faculty_sessions fs
     JOIN faculty f ON fs.faculty_id = f.id
     WHERE fs.token = ? AND fs.expires_at > CURRENT_TIMESTAMP`,
    [token]
  );

  return session || null;
}

// Middleware to protect faculty-only operations
async function requireAuth(req, res, next) {
  try {
    const faculty = await getAuthenticatedFaculty(req);
    if (!faculty) {
      return res.status(401).json({
        error: 'Authentication required. Please login with faculty credentials.',
        code: 'UNAUTHORIZED'
      });
    }
    req.faculty = faculty;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Authentication verification failed: ' + error.message });
  }
}

// Optional Auth (populates req.faculty if logged in, but doesn't block)
async function optionalAuth(req, res, next) {
  try {
    const faculty = await getAuthenticatedFaculty(req);
    if (faculty) req.faculty = faculty;
    next();
  } catch (error) {
    next();
  }
}

// ==========================================
// 1. AUTHENTICATION ROUTES
// ==========================================

// POST /api/auth/login - Faculty login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const trimmedUser = String(username).trim();
    const faculty = await get('SELECT * FROM faculty WHERE LOWER(username) = LOWER(?)', [trimmedUser]);

    if (!faculty) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const passwordMatch = await bcrypt.compare(String(password), faculty.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Generate session token
    const token = crypto.randomBytes(32).toString('hex');
    // Session expires in 24 hours
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);

    await run(
      'INSERT INTO faculty_sessions (token, faculty_id, expires_at) VALUES (?, ?, ?)',
      [token, faculty.id, expiresAt]
    );

    // Set HTTP-only cookie
    res.cookie('session_token', token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax',
      path: '/'
    });

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      faculty: {
        id: faculty.id,
        username: faculty.username,
        name: faculty.name
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed: ' + error.message });
  }
});

// POST /api/auth/logout - Faculty logout
app.post('/api/auth/logout', async (req, res) => {
  try {
    let token = req.cookies && req.cookies.session_token;
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      await run('DELETE FROM faculty_sessions WHERE token = ?', [token]);
    }

    res.clearCookie('session_token', { httpOnly: true, sameSite: 'lax', path: '/' });
    res.cookie('session_token', '', { httpOnly: true, sameSite: 'lax', expires: new Date(0), path: '/' });
    res.status(200).json({ success: true, message: 'Logged out successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Logout failed: ' + error.message });
  }
});

// GET /api/auth/me - Verify current session
app.get('/api/auth/me', async (req, res) => {
  try {
    const faculty = await getAuthenticatedFaculty(req);
    if (!faculty) {
      return res.status(401).json({ authenticated: false, error: 'Not authenticated.' });
    }

    res.status(200).json({
      authenticated: true,
      faculty: {
        id: faculty.faculty_id,
        username: faculty.username,
        name: faculty.name
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify session: ' + error.message });
  }
});

// ==========================================
// 2. STUDENT MANAGEMENT ROUTES
// ==========================================

// GET /api/students - Get all active students (or all if include_inactive=true)
app.get('/api/students', async (req, res) => {
  try {
    const includeInactive = req.query.include_inactive === 'true';
    let query = 'SELECT * FROM students';
    if (!includeInactive) {
      query += ' WHERE is_active = 1';
    }
    query += ' ORDER BY roll_no ASC';

    const students = await all(query);
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve students: ' + error.message });
  }
});

// POST /api/students - Add a new student (Protected)
app.post('/api/students', requireAuth, async (req, res) => {
  try {
    const { roll_no, name, department } = req.body;

    if (!roll_no || !name || !department) {
      return res.status(400).json({ error: 'Roll number, student name, and department are all required.' });
    }

    const trimmedRoll = String(roll_no).trim();
    const trimmedName = String(name).trim();
    const trimmedDept = String(department).trim();

    if (!trimmedRoll || !trimmedName || !trimmedDept) {
      return res.status(400).json({ error: 'Fields cannot be empty or just whitespace.' });
    }

    // Check duplicate roll number
    const existing = await get('SELECT id, is_active FROM students WHERE LOWER(roll_no) = LOWER(?)', [trimmedRoll]);
    if (existing) {
      if (existing.is_active === 1) {
        return res.status(409).json({ error: `Student with roll number "${trimmedRoll}" already exists.` });
      } else {
        // Reactivate student with updated name and department
        await run(
          'UPDATE students SET name = ?, department = ?, is_active = 1 WHERE id = ?',
          [trimmedName, trimmedDept, existing.id]
        );
        const reactivated = await get('SELECT * FROM students WHERE id = ?', [existing.id]);
        return res.status(201).json(reactivated);
      }
    }

    const result = await run(
      'INSERT INTO students (roll_no, name, department, is_active) VALUES (?, ?, ?, 1)',
      [trimmedRoll, trimmedName, trimmedDept]
    );

    const newStudent = await get('SELECT * FROM students WHERE id = ?', [result.id]);
    res.status(201).json(newStudent);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Roll number already exists.' });
    }
    res.status(500).json({ error: 'Failed to create student: ' + error.message });
  }
});

// PUT /api/students/:id - Update student details (Protected)
app.put('/api/students/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { roll_no, name, department, is_active } = req.body;

    const student = await get('SELECT * FROM students WHERE id = ?', [id]);
    if (!student) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    if (!roll_no || !name || !department) {
      return res.status(400).json({ error: 'Roll number, student name, and department are all required.' });
    }

    const trimmedRoll = String(roll_no).trim();
    const trimmedName = String(name).trim();
    const trimmedDept = String(department).trim();

    if (!trimmedRoll || !trimmedName || !trimmedDept) {
      return res.status(400).json({ error: 'Fields cannot be empty or just whitespace.' });
    }

    // Check if new roll number conflicts with another student
    const duplicate = await get(
      'SELECT id FROM students WHERE LOWER(roll_no) = LOWER(?) AND id != ?',
      [trimmedRoll, id]
    );
    if (duplicate) {
      return res.status(409).json({ error: `Another student already has roll number "${trimmedRoll}".` });
    }

    const newActiveState = is_active !== undefined ? (is_active ? 1 : 0) : student.is_active;

    await run(
      'UPDATE students SET roll_no = ?, name = ?, department = ?, is_active = ? WHERE id = ?',
      [trimmedRoll, trimmedName, trimmedDept, newActiveState, id]
    );

    const updatedStudent = await get('SELECT * FROM students WHERE id = ?', [id]);
    res.json(updatedStudent);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update student: ' + error.message });
  }
});

// DELETE /api/students/:id - Delete or deactivate student (Protected)
// Preserves historical records by soft deactivation (or hard delete if ?hard=true for test cleanup)
app.delete('/api/students/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const student = await get('SELECT * FROM students WHERE id = ?', [id]);
    if (!student) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    if (req.query.hard === 'true') {
      await run('DELETE FROM students WHERE id = ?', [id]);
      return res.json({ message: `Student ${student.name} (${student.roll_no}) permanently deleted.` });
    }

    // Soft deletion: deactivates student so they no longer appear in active daily lists,
    // while keeping all historical attendance & internal marks records intact!
    await run('UPDATE students SET is_active = 0 WHERE id = ?', [id]);
    res.json({
      success: true,
      message: `Student ${student.name} (${student.roll_no}) deactivated successfully. Historical records preserved.`
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete student: ' + error.message });
  }
});

// ==========================================
// 3. DAILY ATTENDANCE ROUTES
// ==========================================

// GET /api/attendance - List attendance records (optional query: date, student_id)
app.get('/api/attendance', async (req, res) => {
  try {
    const { date, student_id } = req.query;
    let query = `
      SELECT a.id, a.student_id, s.roll_no, s.name, s.department, s.is_active, a.attendance_date, a.period, a.status
      FROM attendance a
      JOIN students s ON a.student_id = s.id
    `;
    const conditions = [];
    const params = [];

    if (date) {
      conditions.push('a.attendance_date = ?');
      params.push(date);
    }
    if (student_id) {
      conditions.push('a.student_id = ?');
      params.push(student_id);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY a.attendance_date DESC, s.roll_no ASC, a.period ASC';

    const records = await all(query, params);
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch attendance: ' + error.message });
  }
});

// GET /api/attendance/:date - Get attendance for a specific date
app.get('/api/attendance/:date', async (req, res) => {
  try {
    const { date } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    const records = await all(
      `SELECT a.student_id, s.roll_no, s.name, s.department, a.period, a.status
       FROM attendance a
       JOIN students s ON a.student_id = s.id
       WHERE a.attendance_date = ?
       ORDER BY s.roll_no ASC, a.period ASC`,
      [date]
    );

    res.json({
      date,
      count: records.length,
      records
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch date attendance: ' + error.message });
  }
});

// POST /api/attendance - Save or update daily attendance (Protected)
app.post('/api/attendance', requireAuth, async (req, res) => {
  try {
    const { date, records } = req.body;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'A valid date in YYYY-MM-DD format is required.' });
    }

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'Records must be a non-empty array of attendance items.' });
    }

    // Validate all records before inserting
    for (const item of records) {
      const period = Number(item.period);
      if (!item.student_id || isNaN(period) || period < 1 || period > 7) {
        return res.status(400).json({ error: `Invalid period or student ID: student_id=${item.student_id}, period=${item.period}` });
      }
      if (item.status !== 'Present' && item.status !== 'Absent') {
        return res.status(400).json({ error: `Status must be 'Present' or 'Absent'. Received: ${item.status}` });
      }
    }

    // Save attendance in a transaction with UPSERT
    await run('BEGIN TRANSACTION;');

    const upsertSql = `
      INSERT INTO attendance (student_id, attendance_date, period, status)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(student_id, attendance_date, period)
      DO UPDATE SET status = excluded.status;
    `;

    for (const item of records) {
      await run(upsertSql, [item.student_id, date, Number(item.period), item.status]);
    }

    await run('COMMIT;');

    res.status(200).json({
      success: true,
      message: `Successfully saved attendance for ${records.length} period record(s) on ${date}.`,
      date,
      saved_count: records.length
    });
  } catch (error) {
    await run('ROLLBACK;').catch(() => {});
    res.status(500).json({ error: 'Failed to save attendance: ' + error.message });
  }
});

// ==========================================
// 4. MONTHLY REPORT & CSV EXPORT ROUTES
// ==========================================

// Helper function to calculate monthly report data
async function getMonthlyReportData(monthParam, yearParam, thresholdParam) {
  const d = new Date();
  const year = parseInt(yearParam, 10) || d.getFullYear();
  const month = parseInt(monthParam, 10) || (d.getMonth() + 1);
  const threshold = parseFloat(thresholdParam) !== undefined && !isNaN(parseFloat(thresholdParam))
    ? parseFloat(thresholdParam)
    : 75.0;

  const monthStr = `${year}-${String(month).padStart(2, '0')}`;

  // Get registered students
  const students = await all('SELECT * FROM students WHERE is_active = 1 ORDER BY roll_no ASC');

  // Count distinct class periods conducted in this month
  const classPeriodsRow = await get(
    `SELECT COUNT(DISTINCT attendance_date || '-' || period) as total_periods
     FROM attendance
     WHERE SUBSTR(attendance_date, 1, 7) = ?`,
    [monthStr]
  );
  const totalWorkingPeriodsConducted = classPeriodsRow ? classPeriodsRow.total_periods : 0;

  // Attendance aggregates per student for this month
  const studentStats = await all(
    `SELECT 
       student_id,
       SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as present_count,
       SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) as absent_count,
       COUNT(*) as student_recorded_periods
     FROM attendance
     WHERE SUBSTR(attendance_date, 1, 7) = ?
     GROUP BY student_id`,
    [monthStr]
  );

  const statsMap = new Map();
  studentStats.forEach(s => {
    statsMap.set(s.student_id, {
      present: s.present_count || 0,
      absent: s.absent_count || 0,
      recorded: s.student_recorded_periods || 0
    });
  });

  const report = students.map(student => {
    const stats = statsMap.get(student.id) || { present: 0, absent: 0, recorded: 0 };
    const workingPeriods = stats.recorded;
    const present = stats.present;
    const absent = stats.absent;

    // Formula: Attendance Percentage = (Present / Total Recorded Periods) * 100
    // If no recorded periods exist, percentage is null (N/A)
    let percentage = null;
    let percentageDisplay = 'N/A';
    if (workingPeriods > 0) {
      percentage = parseFloat(((present / workingPeriods) * 100).toFixed(2));
      percentageDisplay = `${percentage.toFixed(2)}%`;
    }

    // Threshold rule:
    // Below 75%: Flag student
    // Exactly 75% or above: Do not flag (Satisfactory)
    const isBelowThreshold = percentage !== null && percentage < threshold;

    return {
      id: student.id,
      roll_no: student.roll_no,
      name: student.name,
      department: student.department,
      working_periods: workingPeriods,
      present,
      absent,
      attendance_percentage: percentage,
      attendance_percentage_display: percentageDisplay,
      below_threshold: isBelowThreshold
    };
  });

  const belowThresholdCount = report.filter(r => r.below_threshold).length;

  return {
    month,
    year,
    month_string: monthStr,
    threshold,
    total_students: students.length,
    total_working_periods: totalWorkingPeriodsConducted,
    below_threshold_count: belowThresholdCount,
    students: report
  };
}

// GET /api/report/monthly - Generate class-wide monthly attendance summary
app.get('/api/report/monthly', async (req, res) => {
  try {
    const reportData = await getMonthlyReportData(req.query.month, req.query.year, req.query.threshold);
    res.json(reportData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate monthly report: ' + error.message });
  }
});

// GET /api/report/monthly/export - Download Monthly CSV Report
app.get('/api/report/monthly/export', async (req, res) => {
  try {
    const reportData = await getMonthlyReportData(req.query.month, req.query.year, req.query.threshold);

    // Required CSV Headers:
    // Roll Number, Student Name, Department, Working Periods, Present, Absent, Attendance Percentage
    const headers = [
      'Roll Number',
      'Student Name',
      'Department',
      'Working Periods',
      'Present',
      'Absent',
      'Attendance Percentage'
    ];

    const rows = reportData.students.map(s => {
      // Escape commas and quotes for standard CSV
      const escapedRoll = `"${String(s.roll_no).replace(/"/g, '""')}"`;
      const escapedName = `"${String(s.name).replace(/"/g, '""')}"`;
      const escapedDept = `"${String(s.department).replace(/"/g, '""')}"`;
      const pctValue = s.attendance_percentage !== null ? `"${s.attendance_percentage.toFixed(2)}%"` : '"N/A"';

      return [
        escapedRoll,
        escapedName,
        escapedDept,
        s.working_periods,
        s.present,
        s.absent,
        pctValue
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const filename = `attendance_report_${reportData.month_string}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvContent);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export CSV: ' + error.message });
  }
});

// ==========================================
// 5. INDIVIDUAL STUDENT REPORT
// ==========================================

// GET /api/report/student/:id - Individual student monthly report and daily breakdown
app.get('/api/report/student/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const d = new Date();
    const year = parseInt(req.query.year, 10) || d.getFullYear();
    const month = parseInt(req.query.month, 10) || (d.getMonth() + 1);
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;

    const student = await get('SELECT * FROM students WHERE id = ?', [id]);
    if (!student) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    // Daily breakdown for this student in the month
    const dailyRecords = await all(
      `SELECT attendance_date, period, status
       FROM attendance
       WHERE student_id = ? AND SUBSTR(attendance_date, 1, 7) = ?
       ORDER BY attendance_date ASC, period ASC`,
      [id, monthStr]
    );

    // Group by date
    const dateMap = {};
    dailyRecords.forEach(r => {
      if (!dateMap[r.attendance_date]) {
        dateMap[r.attendance_date] = {
          date: r.attendance_date,
          periods: { 1: '-', 2: '-', 3: '-', 4: '-', 5: '-', 6: '-', 7: '-' },
          present_count: 0,
          absent_count: 0
        };
      }
      dateMap[r.attendance_date].periods[r.period] = r.status;
      if (r.status === 'Present') dateMap[r.attendance_date].present_count += 1;
      if (r.status === 'Absent') dateMap[r.attendance_date].absent_count += 1;
    });

    const dailyBreakdown = Object.values(dateMap);

    const totalWorkingPeriods = dailyRecords.length;
    const presentPeriods = dailyRecords.filter(r => r.status === 'Present').length;
    const absentPeriods = dailyRecords.filter(r => r.status === 'Absent').length;
    const attendancePercentage = totalWorkingPeriods > 0 
      ? parseFloat(((presentPeriods / totalWorkingPeriods) * 100).toFixed(2)) 
      : null;

    // Also fetch internal marks for this student
    const marks = await all(
      `SELECT id, subject, assessment_name, marks_obtained, max_marks,
              ROUND((marks_obtained / max_marks) * 100, 2) as marks_percentage,
              created_at
       FROM internal_marks
       WHERE student_id = ?
       ORDER BY subject ASC, assessment_name ASC`,
      [id]
    );

    res.json({
      student,
      month,
      year,
      month_string: monthStr,
      total_working_periods: totalWorkingPeriods,
      present_periods: presentPeriods,
      absent_periods: absentPeriods,
      attendance_percentage: attendancePercentage,
      attendance_percentage_display: attendancePercentage !== null ? `${attendancePercentage.toFixed(2)}%` : 'N/A',
      history: dailyBreakdown,
      internal_marks: marks
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch student report: ' + error.message });
  }
});

// GET /api/report/academic/:id - Combined Academic Performance Report
app.get('/api/report/academic/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const student = await get('SELECT * FROM students WHERE id = ?', [id]);
    if (!student) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    // Overall attendance totals
    const attendanceStats = await get(
      `SELECT 
         COUNT(*) as total_periods,
         SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as present_periods,
         SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) as absent_periods
       FROM attendance
       WHERE student_id = ?`,
      [id]
    );

    const totalPeriods = attendanceStats ? attendanceStats.total_periods : 0;
    const presentPeriods = attendanceStats ? attendanceStats.present_periods : 0;
    const absentPeriods = attendanceStats ? attendanceStats.absent_periods : 0;
    const attendancePercentage = totalPeriods > 0
      ? parseFloat(((presentPeriods / totalPeriods) * 100).toFixed(2))
      : null;

    // Internal marks & performance calculations
    const marks = await all(
      `SELECT id, subject, assessment_name, marks_obtained, max_marks,
              ROUND((marks_obtained / max_marks) * 100, 2) as marks_percentage,
              created_at
       FROM internal_marks
       WHERE student_id = ?
       ORDER BY subject ASC, assessment_name ASC`,
      [id]
    );

    let totalMarksObtained = 0;
    let totalMaxMarks = 0;
    marks.forEach(m => {
      totalMarksObtained += m.marks_obtained;
      totalMaxMarks += m.max_marks;
    });

    const overallAcademicPercentage = totalMaxMarks > 0
      ? parseFloat(((totalMarksObtained / totalMaxMarks) * 100).toFixed(2))
      : null;

    res.json({
      student: {
        id: student.id,
        roll_no: student.roll_no,
        name: student.name,
        department: student.department,
        is_active: student.is_active
      },
      attendance: {
        total_periods: totalPeriods,
        present_periods: presentPeriods,
        absent_periods: absentPeriods,
        attendance_percentage: attendancePercentage,
        attendance_percentage_display: attendancePercentage !== null ? `${attendancePercentage.toFixed(2)}%` : 'N/A'
      },
      academic_performance: {
        marks_count: marks.length,
        total_marks_obtained: totalMarksObtained,
        total_max_marks: totalMaxMarks,
        overall_percentage: overallAcademicPercentage,
        overall_percentage_display: overallAcademicPercentage !== null ? `${overallAcademicPercentage.toFixed(2)}%` : 'N/A',
        marks_details: marks
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate academic report: ' + error.message });
  }
});

// ==========================================
// 6. INTERNAL MARKS MANAGEMENT ROUTES
// ==========================================

// GET /api/marks - List internal marks (optional query: student_id)
app.get('/api/marks', async (req, res) => {
  try {
    const { student_id } = req.query;
    let query = `
      SELECT m.id, m.student_id, s.roll_no, s.name as student_name, s.department,
             m.subject, m.assessment_name, m.marks_obtained, m.max_marks,
             ROUND((m.marks_obtained / m.max_marks) * 100, 2) as marks_percentage,
             m.created_at
      FROM internal_marks m
      JOIN students s ON m.student_id = s.id
    `;
    const params = [];

    if (student_id) {
      query += ' WHERE m.student_id = ?';
      params.push(student_id);
    }
    query += ' ORDER BY s.roll_no ASC, m.subject ASC, m.assessment_name ASC';

    const marks = await all(query, params);
    res.json(marks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve internal marks: ' + error.message });
  }
});

// POST /api/marks - Add or upsert internal marks (Protected)
app.post('/api/marks', requireAuth, async (req, res) => {
  try {
    const { student_id, subject, assessment_name, marks_obtained, max_marks } = req.body;

    // Validations
    if (!student_id) {
      return res.status(400).json({ error: 'Student selection is required.' });
    }

    const student = await get('SELECT id, name, roll_no FROM students WHERE id = ?', [student_id]);
    if (!student) {
      return res.status(404).json({ error: 'Selected student does not exist.' });
    }

    const trimmedSubject = String(subject || '').trim();
    const trimmedAssessment = String(assessment_name || '').trim();

    if (!trimmedSubject) {
      return res.status(400).json({ error: 'Subject name is required and cannot be empty.' });
    }
    if (!trimmedAssessment) {
      return res.status(400).json({ error: 'Assessment name is required and cannot be empty.' });
    }

    const marksObtainedNum = parseFloat(marks_obtained);
    const maxMarksNum = parseFloat(max_marks);

    if (isNaN(marksObtainedNum)) {
      return res.status(400).json({ error: 'Marks obtained must be a valid number.' });
    }
    if (isNaN(maxMarksNum)) {
      return res.status(400).json({ error: 'Maximum marks must be a valid number.' });
    }
    if (marksObtainedNum < 0) {
      return res.status(400).json({ error: 'Marks obtained cannot be negative.' });
    }
    if (maxMarksNum <= 0) {
      return res.status(400).json({ error: 'Maximum marks must be greater than zero.' });
    }
    if (marksObtainedNum > maxMarksNum) {
      return res.status(400).json({ error: `Marks obtained (${marksObtainedNum}) cannot exceed maximum marks (${maxMarksNum}).` });
    }

    // Check duplicate assessment record
    const existing = await get(
      `SELECT id FROM internal_marks WHERE student_id = ? AND LOWER(subject) = LOWER(?) AND LOWER(assessment_name) = LOWER(?)`,
      [student_id, trimmedSubject, trimmedAssessment]
    );

    if (existing) {
      // Update existing assessment record to prevent accidental duplicates
      await run(
        `UPDATE internal_marks SET marks_obtained = ?, max_marks = ? WHERE id = ?`,
        [marksObtainedNum, maxMarksNum, existing.id]
      );
      const updated = await get(
        `SELECT m.*, ROUND((m.marks_obtained / m.max_marks) * 100, 2) as marks_percentage
         FROM internal_marks m WHERE id = ?`,
        [existing.id]
      );
      return res.status(200).json({
        success: true,
        message: 'Existing marks record updated successfully.',
        record: updated
      });
    }

    const insertResult = await run(
      `INSERT INTO internal_marks (student_id, subject, assessment_name, marks_obtained, max_marks)
       VALUES (?, ?, ?, ?, ?)`,
      [student_id, trimmedSubject, trimmedAssessment, marksObtainedNum, maxMarksNum]
    );

    const newRecord = await get(
      `SELECT m.*, ROUND((m.marks_obtained / m.max_marks) * 100, 2) as marks_percentage
       FROM internal_marks m WHERE id = ?`,
      [insertResult.id]
    );

    res.status(201).json({
      success: true,
      message: 'Internal marks saved successfully.',
      record: newRecord
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save marks: ' + error.message });
  }
});

// PUT /api/marks/:id - Update existing internal marks (Protected)
app.put('/api/marks/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, assessment_name, marks_obtained, max_marks } = req.body;

    const existing = await get('SELECT * FROM internal_marks WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Marks record not found.' });
    }

    const trimmedSubject = subject !== undefined ? String(subject).trim() : existing.subject;
    const trimmedAssessment = assessment_name !== undefined ? String(assessment_name).trim() : existing.assessment_name;

    if (!trimmedSubject) {
      return res.status(400).json({ error: 'Subject cannot be empty.' });
    }
    if (!trimmedAssessment) {
      return res.status(400).json({ error: 'Assessment name cannot be empty.' });
    }

    const marksObtainedNum = marks_obtained !== undefined ? parseFloat(marks_obtained) : existing.marks_obtained;
    const maxMarksNum = max_marks !== undefined ? parseFloat(max_marks) : existing.max_marks;

    if (isNaN(marksObtainedNum) || marksObtainedNum < 0) {
      return res.status(400).json({ error: 'Marks obtained must be a non-negative number.' });
    }
    if (isNaN(maxMarksNum) || maxMarksNum <= 0) {
      return res.status(400).json({ error: 'Maximum marks must be greater than zero.' });
    }
    if (marksObtainedNum > maxMarksNum) {
      return res.status(400).json({ error: `Marks obtained (${marksObtainedNum}) cannot exceed maximum marks (${maxMarksNum}).` });
    }

    // Check duplicate for other records of same student
    const duplicate = await get(
      `SELECT id FROM internal_marks
       WHERE student_id = ? AND LOWER(subject) = LOWER(?) AND LOWER(assessment_name) = LOWER(?) AND id != ?`,
      [existing.student_id, trimmedSubject, trimmedAssessment, id]
    );
    if (duplicate) {
      return res.status(409).json({ error: 'Another record already exists with this subject and assessment name.' });
    }

    await run(
      `UPDATE internal_marks SET subject = ?, assessment_name = ?, marks_obtained = ?, max_marks = ? WHERE id = ?`,
      [trimmedSubject, trimmedAssessment, marksObtainedNum, maxMarksNum, id]
    );

    const updated = await get(
      `SELECT m.*, ROUND((m.marks_obtained / m.max_marks) * 100, 2) as marks_percentage
       FROM internal_marks m WHERE id = ?`,
      [id]
    );

    res.json({
      success: true,
      message: 'Marks updated successfully.',
      record: updated
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update marks: ' + error.message });
  }
});

// DELETE /api/marks/:id - Delete an internal marks record (Protected)
app.delete('/api/marks/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await get('SELECT * FROM internal_marks WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Marks record not found.' });
    }

    await run('DELETE FROM internal_marks WHERE id = ?', [id]);
    res.json({ success: true, message: 'Marks record deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete marks: ' + error.message });
  }
});

// ==========================================
// 7. DASHBOARD ROUTE
// ==========================================

// GET /api/dashboard - Real-time statistics for dashboard
app.get('/api/dashboard', async (req, res) => {
  try {
    const today = getTodayDateString();
    const currentMonth = today.substring(0, 7);

    // 1. Total active registered students
    const totalStudentsRow = await get('SELECT COUNT(*) as count FROM students WHERE is_active = 1');
    const totalStudents = totalStudentsRow ? totalStudentsRow.count : 0;

    // 2. Today's attendance stats
    const todayStats = await all(
      `SELECT status, COUNT(*) as count
       FROM attendance a
       JOIN students s ON a.student_id = s.id
       WHERE a.attendance_date = ? AND s.is_active = 1
       GROUP BY status`,
      [today]
    );

    let todayPresent = 0;
    let todayAbsent = 0;
    todayStats.forEach(row => {
      if (row.status === 'Present') todayPresent = row.count;
      if (row.status === 'Absent') todayAbsent = row.count;
    });

    const todayTotalPeriodsMarked = todayPresent + todayAbsent;
    const isTodayMarked = todayTotalPeriodsMarked > 0;

    // 3. Students below 75% for current month
    const studentAggregates = await all(
      `SELECT 
         s.id, s.roll_no, s.name, s.department,
         SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) as present_count,
         COUNT(a.id) as total_count
       FROM students s
       LEFT JOIN attendance a ON s.id = a.student_id AND SUBSTR(a.attendance_date, 1, 7) = ?
       WHERE s.is_active = 1
       GROUP BY s.id`,
      [currentMonth]
    );

    const belowThresholdList = [];
    studentAggregates.forEach(s => {
      if (s.total_count > 0) {
        const pct = (s.present_count / s.total_count) * 100;
        if (pct < 75.0) {
          belowThresholdList.push({
            id: s.id,
            roll_no: s.roll_no,
            name: s.name,
            department: s.department,
            present: s.present_count,
            total: s.total_count,
            percentage: parseFloat(pct.toFixed(2))
          });
        }
      }
    });

    // Recent registered students
    const recentStudents = await all('SELECT * FROM students WHERE is_active = 1 ORDER BY id DESC LIMIT 5');

    res.json({
      today_date: today,
      total_students: totalStudents,
      is_today_marked: isTodayMarked,
      today_total_marks: todayTotalPeriodsMarked,
      today_present: todayPresent,
      today_absent: todayAbsent,
      below_75_count: belowThresholdList.length,
      below_75_students: belowThresholdList,
      recent_students: recentStudents
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve dashboard stats: ' + error.message });
  }
});

// Server Initialization
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` Student Attendance Management System (DevOps Project)`);
  console.log(` Server running on: http://localhost:${PORT}`);
  console.log(` Today: ${getTodayDateString()}`);
  console.log(`====================================================`);
});
