const { db, run, all } = require('./database/db');

async function seedDatabase() {
  console.log('--- Starting Database Seeding ---');

  try {
    // 1. Clear existing data for clean re-seeding
    await run('DELETE FROM attendance');
    await run('DELETE FROM students');
    await run('DELETE FROM sqlite_sequence WHERE name IN ("students", "attendance")');
    console.log('Cleared existing student and attendance records.');

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
        'INSERT INTO students (roll_no, name, department) VALUES (?, ?, ?)',
        [student.roll_no, student.name, student.department]
      );
    }
    console.log(`Inserted ${testStudents.length} test students.`);

    // Fetch inserted student IDs
    const students = await all('SELECT id, roll_no FROM students ORDER BY roll_no ASC');
    const studentMap = {};
    students.forEach(s => { studentMap[s.roll_no] = s.id; });

    // Generate 22 working days for October 2026 (matching sample screenshot with 154 working periods = 22 days * 7 periods)
    // 2026-10 working days
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

    // Number of periods per day = 7 -> 22 * 7 = 154 working periods
    // Target Present counts matching the document's sample screenshot:
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
      '107': 45, // Also below 75%
      '108': 8,
      '109': 12,
      '110': 3
    };

    console.log('Generating attendance across 22 working days (154 periods per student)...');

    await run('BEGIN TRANSACTION;');

    for (const student of students) {
      const neededAbsences = targetAbsences[student.roll_no] || 10;
      let absenceCount = 0;

      // We have 154 slots (22 days * 7 periods)
      // Distribute absences across the days
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

    // Also seed today's date if not in October 2026 so dashboard shows today's data immediately!
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (!workingDates.includes(todayStr)) {
      console.log(`Seeding sample attendance for today (${todayStr})...`);
      for (const student of students) {
        for (let period = 1; period <= 7; period++) {
          // Default to Present, with student 103 absent in P2 and P5
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

    await run('COMMIT;');

    console.log('✅ Seeding completed successfully!');
    console.log('Test student summary:');
    console.log('- 101: Student 1 (90.91%)');
    console.log('- 102: Student 2 (84.42%)');
    console.log('- 103: Student 3 (74.68% - Low Attendance Alert)');
    console.log('- 104: Student 4 (97.40%)');
    console.log('- 105: Student 5 (94.16%)');
    console.log('- 107: Student 7 (70.78% - Low Attendance Alert)');

    process.exit(0);
  } catch (error) {
    await run('ROLLBACK;').catch(() => {});
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seedDatabase();
