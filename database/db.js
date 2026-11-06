const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Ensure database folder exists
const dbDir = path.join(__dirname);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'attendance.db');

// Connect to SQLite Database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening SQLite database:', err.message);
  } else {
    console.log(`Connected to SQLite database at: ${dbPath}`);
  }
});

// Initialize Tables and Constraints
db.serialize(() => {
  // Enable Foreign Key support
  db.run('PRAGMA foreign_keys = ON;');

  // Faculty Table
  db.run(`
    CREATE TABLE IF NOT EXISTS faculty (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Faculty Sessions Table
  db.run(`
    CREATE TABLE IF NOT EXISTS faculty_sessions (
      token TEXT PRIMARY KEY,
      faculty_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE CASCADE
    );
  `);

  // Students Table
  db.run(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      roll_no TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      department TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Safely ensure is_active column exists if table was created previously without it
  db.run(`ALTER TABLE students ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;`, (err) => {
    // Ignore error if column already exists
  });

  // Attendance Table
  // Unique constraint ensures a student has only 1 status per date per period
  db.run(`
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
  `);

  // Internal Marks Table
  db.run(`
    CREATE TABLE IF NOT EXISTS internal_marks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      subject TEXT NOT NULL,
      assessment_name TEXT NOT NULL,
      marks_obtained REAL NOT NULL CHECK (marks_obtained >= 0),
      max_marks REAL NOT NULL CHECK (max_marks > 0),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      CHECK (marks_obtained <= max_marks),
      UNIQUE (student_id, subject, assessment_name)
    );
  `);

  // Indexes for optimal query performance
  db.run(`CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_internal_marks_student ON internal_marks(student_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_faculty_sessions_token ON faculty_sessions(token);`);

  // Seed default faculty account if none exists
  db.get(`SELECT COUNT(*) as count FROM faculty`, (err, row) => {
    if (!err && row && row.count === 0) {
      const defaultUser = process.env.FACULTY_USERNAME || 'faculty';
      const defaultPass = process.env.FACULTY_PASSWORD || 'password123';
      const defaultName = process.env.FACULTY_NAME || 'Faculty Member';
      const hash = bcrypt.hashSync(defaultPass, 10);
      db.run(
        `INSERT INTO faculty (username, password_hash, name) VALUES (?, ?, ?)`,
        [defaultUser, hash, defaultName],
        (insertErr) => {
          if (!insertErr) {
            console.log(`Default faculty account initialized: username="${defaultUser}"`);
          }
        }
      );
    }
  });
});

// Promise-based query helpers for clean async/await
const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

module.exports = {
  db,
  run,
  get,
  all
};
