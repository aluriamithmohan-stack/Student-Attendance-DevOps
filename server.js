const express = require('express');
const path = require('path');
const { db, run, get, all } = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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
// 1. STUDENT MANAGEMENT ROUTES
// ==========================================

// GET /api/students - Get all students
app.get('/api/students', async (req, res) => {
  try {
    const students = await all('SELECT * FROM students ORDER BY roll_no ASC');
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve students: ' + error.message });
  }
});

// POST /api/students - Add a new student
app.post('/api/students', async (req, res) => {
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
    const existing = await get('SELECT id FROM students WHERE LOWER(roll_no) = LOWER(?)', [trimmedRoll]);
    if (existing) {
      return res.status(409).json({ error: `Student with roll number "${trimmedRoll}" already exists.` });
    }

    const result = await run(
      'INSERT INTO students (roll_no, name, department) VALUES (?, ?, ?)',
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

// PUT /api/students/:id - Update student details
app.put('/api/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { roll_no, name, department } = req.body;

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

    // Check if new roll number conflicts with another student
    const duplicate = await get(
      'SELECT id FROM students WHERE LOWER(roll_no) = LOWER(?) AND id != ?',
      [trimmedRoll, id]
    );
    if (duplicate) {
      return res.status(409).json({ error: `Another student already has roll number "${trimmedRoll}".` });
    }

    await run(
      'UPDATE students SET roll_no = ?, name = ?, department = ? WHERE id = ?',
      [trimmedRoll, trimmedName, trimmedDept, id]
    );

    const updatedStudent = await get('SELECT * FROM students WHERE id = ?', [id]);
    res.json(updatedStudent);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update student: ' + error.message });
  }
});

// DELETE /api/students/:id - Delete a student
app.delete('/api/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const student = await get('SELECT * FROM students WHERE id = ?', [id]);
    if (!student) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    await run('DELETE FROM students WHERE id = ?', [id]);
    res.json({ message: `Student ${student.name} (${student.roll_no}) deleted successfully.` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete student: ' + error.message });
  }
});

// ==========================================
// 2. DAILY ATTENDANCE ROUTES
// ==========================================

// GET /api/attendance - List attendance (optional query: date)
app.get('/api/attendance', async (req, res) => {
  try {
    const { date } = req.query;
    let query = `
      SELECT a.id, a.student_id, s.roll_no, s.name, s.department, a.attendance_date, a.period, a.status
      FROM attendance a
      JOIN students s ON a.student_id = s.id
    `;
    const params = [];

    if (date) {
      query += ' WHERE a.attendance_date = ?';
      params.push(date);
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
    // Validate date format YYYY-MM-DD
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

// POST /api/attendance - Save or update daily attendance
app.post('/api/attendance', async (req, res) => {
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
    // SQLite 3.24+ supports ON CONFLICT(...) DO UPDATE
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
// 3. MONTHLY REPORT & STUDENT REPORT ROUTES
// ==========================================

// GET /api/report/monthly - Generate class-wide monthly attendance summary
app.get('/api/report/monthly', async (req, res) => {
  try {
    const d = new Date();
    const currentYear = d.getFullYear();
    const currentMonth = d.getMonth() + 1;

    const year = parseInt(req.query.year, 10) || currentYear;
    const month = parseInt(req.query.month, 10) || currentMonth;
    const threshold = parseFloat(req.query.threshold) || 75.0;

    const monthStr = `${year}-${String(month).padStart(2, '0')}`;

    // 1. Get all registered students
    const students = await all('SELECT * FROM students ORDER BY roll_no ASC');

    // 2. Total class working periods conducted in this month
    // Distinct combinations of date and period recorded in attendance
    const classPeriodsRow = await get(
      `SELECT COUNT(DISTINCT attendance_date || '-' || period) as total_periods
       FROM attendance
       WHERE SUBSTR(attendance_date, 1, 7) = ?`,
      [monthStr]
    );
    const totalWorkingPeriodsConducted = classPeriodsRow ? classPeriodsRow.total_periods : 0;

    // 3. Attendance aggregates per student for this month
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
      // Working periods for this student (periods marked, or fallback to class conducted periods)
      const workingPeriods = stats.recorded > 0 ? stats.recorded : (totalWorkingPeriodsConducted > 0 ? totalWorkingPeriodsConducted : 0);
      const present = stats.present;
      const absent = stats.recorded > 0 ? stats.absent : (workingPeriods - present);

      let percentage = 0;
      if (workingPeriods > 0) {
        percentage = parseFloat(((present / workingPeriods) * 100).toFixed(2));
      }

      const isBelowThreshold = percentage < threshold;

      return {
        id: student.id,
        roll_no: student.roll_no,
        name: student.name,
        department: student.department,
        working_periods: workingPeriods,
        present,
        absent,
        attendance_percentage: percentage,
        below_threshold: isBelowThreshold
      };
    });

    const belowThresholdCount = report.filter(r => r.below_threshold).length;

    res.json({
      month,
      year,
      month_string: monthStr,
      threshold,
      total_students: students.length,
      total_working_periods: totalWorkingPeriodsConducted,
      below_threshold_count: belowThresholdCount,
      students: report
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate monthly report: ' + error.message });
  }
});

// GET /api/report/student/:id - Individual student monthly report and breakdown
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
      : 0;

    res.json({
      student,
      month,
      year,
      month_string: monthStr,
      total_working_periods: totalWorkingPeriods,
      present_periods: presentPeriods,
      absent_periods: absentPeriods,
      attendance_percentage: attendancePercentage,
      history: dailyBreakdown
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch student report: ' + error.message });
  }
});

// ==========================================
// 4. DASHBOARD ROUTE
// ==========================================

// GET /api/dashboard - Summary stats for dashboard
app.get('/api/dashboard', async (req, res) => {
  try {
    const today = getTodayDateString();
    const currentMonth = today.substring(0, 7);

    // 1. Total registered students
    const totalStudentsRow = await get('SELECT COUNT(*) as count FROM students');
    const totalStudents = totalStudentsRow ? totalStudentsRow.count : 0;

    // 2. Today's attendance stats
    const todayStats = await all(
      `SELECT status, COUNT(*) as count
       FROM attendance
       WHERE attendance_date = ?
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
    const recentStudents = await all('SELECT * FROM students ORDER BY id DESC LIMIT 5');

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
