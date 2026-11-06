const { db, run, all } = require('./database/db');

async function seedDatabase() {
  console.log('--- Starting Database Seeding ---');

  try {
    // 1. Clear existing data for clean re-seeding
    await run('DELETE FROM internal_marks');
    await run('DELETE FROM attendance');
    await run('DELETE FROM students');
    await run('DELETE FROM sqlite_sequence WHERE name IN ("students", "attendance", "internal_marks")');
    console.log('Cleared existing student, attendance, and marks records.');

    // 2. Insert Test Students
    const testStudents = [
      { roll_no: '101', name: 'Student 1', department: 'CSE (AI & ML)' },
      { roll_no: '102', name: 'Student 2', department: 'CSE (AI & ML)' },
      { roll_no: '103', name: 'Student 3', department: 'CSE (AI & ML)' },
      { roll_no: '104', name: 'Student 4', department: 'CSE (AI & ML)' },
      { roll_no: '105', name: 'Student 5', department: 'CSE (AI & ML)' },
      { roll_no: '106', name: 'Student 6', department: 'CSE (AI & ML)' },
      { roll_no: '107', name: 'Student 7', department: 'CSE' },
      { roll_no: '108', name: 'Student 8', department: 'CSE' },
      { roll_no: '109', name: 'Student 9', department: 'CSE' },
      { roll_no: '110', name: 'Student 10', department: 'CSE' }
    ];

    for (const student of testStudents) {
      await run(
        'INSERT INTO students (roll_no, name, department, is_active) VALUES (?, ?, ?, 1)',
        [student.roll_no, student.name, student.department]
      );
    }
    console.log(`Inserted ${testStudents.length} test students.`);

    // Fetch inserted student IDs
    const students = await all('SELECT id, roll_no FROM students ORDER BY roll_no ASC');
    const studentMap = {};
    students.forEach(s => { studentMap[s.roll_no] = s.id; });

    // Generate 22 working days for October 2026 (154 working periods = 22 days * 7 periods)
    const workingDates = [];
    for (let day = 1; day <= 30; day++) {
      const d = new Date(2026, 9, day); // month 9 is October (0-indexed)
      const dayOfWeek = d.getDay();
      // Skip Sundays (0) and Saturdays (6)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const dd = String(day).padStart(2, '0');
        workingDates.push(`2026-10-${dd}`);
        if (workingDates.length === 22) break; // 22 working days
      }
    }

    // Target Present counts matching sample data:
    // 101: 140 present (14 absent) -> 90.91%
    // 102: 130 present (24 absent) -> 84.42%
    // 103: 115 present (39 absent) -> 74.68% (Below 75%)
    // 104: 150 present (4 absent)  -> 97.40%
    // 105: 145 present (9 absent)  -> 94.16%
    const targetAbsences = {
      '101': 14,
      '102': 24,
      '103': 39,
      '104': 4,
      '105': 9,
      '106': 18,
      '107': 45, // Below 75%
      '108': 8,
      '109': 12,
      '110': 3
    };

    console.log('Generating attendance across 22 working days (154 periods per student)...');

    await run('BEGIN TRANSACTION;');

    for (const student of students) {
      const neededAbsences = targetAbsences[student.roll_no] || 10;
      let absenceCount = 0;
      let slotIndex = 0;
      const interval = Math.floor(154 / neededAbsences);

      for (const date of workingDates) {
        for (let period = 1; period <= 7; period++) {
          slotIndex++;
          let status = 'Present';

          if (absenceCount < neededAbsences && slotIndex % interval === 0) {
            status = 'Absent';
            absenceCount++;
          }

          await run(
            `INSERT INTO attendance (student_id, attendance_date, period, status)
             VALUES (?, ?, ?, ?)`,
            [student.id, date, period, status]
          );
        }
      }
    }

    // Also seed today's date so dashboard has immediate stats
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (!workingDates.includes(todayStr)) {
      console.log(`Seeding sample attendance for today (${todayStr})...`);
      for (const student of students) {
        for (let period = 1; period <= 7; period++) {
          let status = 'Present';
          if (student.roll_no === '103' && (period === 2 || period === 5)) status = 'Absent';
          if (student.roll_no === '107' && period >= 4) status = 'Absent';

          await run(
            `INSERT INTO attendance (student_id, attendance_date, period, status)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(student_id, attendance_date, period) DO UPDATE SET status = excluded.status`,
            [student.id, todayStr, period, status]
          );
        }
      }
    }

    // 3. Seed Internal Marks
    console.log('Seeding sample internal marks...');
    const sampleAssessments = [
      { subject: 'DevOps & Cloud Computing', assessment: 'Internal Test 1', max: 25 },
      { subject: 'DevOps & Cloud Computing', assessment: 'Lab Assessment', max: 50 },
      { subject: 'Machine Learning', assessment: 'Mid-Term Exam', max: 30 }
    ];

    const studentMarksRatio = {
      '101': 0.92,
      '102': 0.84,
      '103': 0.68,
      '104': 0.96,
      '105': 0.90,
      '106': 0.82,
      '107': 0.70,
      '108': 0.88,
      '109': 0.78,
      '110': 0.95
    };

    for (const student of students) {
      const ratio = studentMarksRatio[student.roll_no] || 0.80;
      for (const a of sampleAssessments) {
        const marksObtained = Math.round(a.max * ratio * 10) / 10;
        await run(
          `INSERT INTO internal_marks (student_id, subject, assessment_name, marks_obtained, max_marks)
           VALUES (?, ?, ?, ?, ?)`,
          [student.id, a.subject, a.assessment, marksObtained, a.max]
        );
      }
    }

    await run('COMMIT;');

    console.log('✅ Seeding completed successfully!');
    console.log('Seeded 10 students, 1540+ attendance periods, and internal marks.');
    process.exit(0);
  } catch (error) {
    await run('ROLLBACK;').catch(() => {});
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seedDatabase();
