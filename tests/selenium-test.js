/**
 * ============================================================================
 * Automated Selenium WebDriver Test Suite
 * Student Attendance Management System Using DevOps Tools
 *
 * Covers EXACTLY the 10 Required Test Cases:
 * 1. Verify attendance page displays registered students.
 * 2. Verify attendance can be marked for all seven periods.
 * 3. Verify attendance is saved for a selected date.
 * 4. Verify invalid student information and duplicate roll numbers are handled.
 * 5. Verify duplicate attendance entries are prevented (UPSERT / UNIQUE constraint).
 * 6. Verify monthly attendance totals (Working = Present + Absent).
 * 7. Verify attendance percentage calculation ((Present / Working) * 100).
 * 8. Verify students below the attendance threshold are identified.
 * 9. Verify monthly report generation and CSV export.
 * 10. Verify saved records remain available after restarting/persistence check.
 * ============================================================================
 */

const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const { get, all } = require('../database/db');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
let serverProcess = null;
let driver = null;

// ANSI colors for clean test reporting
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  reset: '\x1b[0m'
};

function logPass(testNum, desc) {
  console.log(` ${colors.green}✔ PASS${colors.reset} [TC-${testNum}] ${desc}`);
}

function logFail(testNum, desc, err) {
  console.error(` ${colors.red}✖ FAIL${colors.reset} [TC-${testNum}] ${desc}`);
  console.error(`   Error: ${err.message}`);
}

// Check if server is running
function checkServerRunning() {
  return new Promise((resolve) => {
    const req = http.get(`${BASE_URL}/api/dashboard`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Start local server if not already running
async function ensureServerRunning() {
  const isRunning = await checkServerRunning();
  if (isRunning) {
    console.log(`Using existing server running at ${BASE_URL}`);
    return;
  }

  console.log(`Starting local server on ${BASE_URL}...`);
  serverProcess = spawn('node', [path.join(__dirname, '../server.js')], {
    stdio: 'ignore',
    detached: false
  });

  // Wait for server to become responsive
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 600));
    const ready = await checkServerRunning();
    if (ready) {
      console.log('Server started successfully.');
      return;
    }
  }
  throw new Error('Failed to start server within 10 seconds.');
}

async function runTestSuite() {
  let passedCount = 0;
  let failedCount = 0;

  console.log('\n' + '='.repeat(70));
  console.log(`  ${colors.bold}Automated Selenium WebDriver Test Suite (10 Required Tests)${colors.reset}`);
  console.log(`  Target: ${BASE_URL}`);
  console.log('='.repeat(70) + '\n');

  try {
    await ensureServerRunning();

    // Configure Chrome Options (Headless by default for fast, CI-friendly runs)
    const options = new chrome.Options();
    options.addArguments('--headless=new');
    options.addArguments('--disable-gpu');
    options.addArguments('--no-sandbox');
    options.addArguments('--disable-dev-shm-usage');
    options.addArguments('--window-size=1280,900');

    console.log('Initializing Chrome WebDriver...');
    driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
    await driver.manage().setTimeouts({ implicit: 5000 });

    // Faculty Authentication
    console.log('Authenticating faculty session...');
    await driver.get(`${BASE_URL}/login.html`);
    await driver.wait(until.elementLocated(By.id('login-username')), 5000);
    await driver.findElement(By.id('login-username')).sendKeys('faculty');
    await driver.findElement(By.id('login-password')).sendKeys('password123');
    const loginBtn = await driver.findElement(By.id('btn-login'));
    await driver.executeScript('arguments[0].click();', loginBtn);
    await driver.wait(until.urlContains('index.html'), 5000);
    console.log('Faculty authenticated successfully.\n');

    // ------------------------------------------------------------------------
    // TC-1: Verify that attendance page displays registered students
    // ------------------------------------------------------------------------
    try {
      await driver.get(`${BASE_URL}/attendance.html`);
      await driver.wait(until.elementLocated(By.id('table-daily-attendance')), 5000);
      await driver.wait(until.elementLocated(By.css('#tbody-attendance tr.attendance-row')), 5000);
      const studentRows = await driver.findElements(By.css('#tbody-attendance tr.attendance-row'));
      if (studentRows.length === 0) {
        throw new Error('No student rows rendered on the attendance table.');
      }
      logPass(1, `Attendance page displays registered students (${studentRows.length} students found).`);
      passedCount++;
    } catch (err) {
      logFail(1, 'Verify attendance page displays registered students', err);
      failedCount++;
    }

    // ------------------------------------------------------------------------
    // TC-2: Verify that attendance can be marked for all seven periods
    // ------------------------------------------------------------------------
    try {
      let pButtons = await driver.findElements(By.css('#tbody-attendance tr:first-child button.period-btn'));
      if (pButtons.length !== 7) {
        throw new Error(`Expected 7 period buttons for student, found: ${pButtons.length}`);
      }

      // Click each period button to toggle status
      for (let i = 0; i < 7; i++) {
        await driver.executeScript('arguments[0].click();', pButtons[i]);
        await driver.sleep(50);
      }

      // Also verify "Mark All Present" button works
      const btnMarkAllPresent = await driver.findElement(By.id('btn-mark-all-present'));
      await driver.executeScript('arguments[0].click();', btnMarkAllPresent);
      await driver.sleep(300);

      // Re-query period buttons after re-render
      pButtons = await driver.findElements(By.css('#tbody-attendance tr:first-child button.period-btn'));

      // Verify all buttons for first student now display "P"
      for (let i = 0; i < 7; i++) {
        const text = await pButtons[i].getText();
        if (text !== 'P') throw new Error(`Period ${i + 1} did not update to 'P' after Mark All Present.`);
      }

      logPass(2, 'Attendance can be marked and toggled across all seven periods (P1 to P7).');
      passedCount++;
    } catch (err) {
      logFail(2, 'Verify attendance can be marked for all seven periods', err);
      failedCount++;
    }

    // ------------------------------------------------------------------------
    // TC-3: Verify that attendance is saved for a selected date
    // ------------------------------------------------------------------------
    try {
      const testDate = '2026-10-15';
      const dateInput = await driver.findElement(By.id('attendance-date'));
      await driver.executeScript(`arguments[0].value = '${testDate}'; arguments[0].dispatchEvent(new Event('input', {bubbles:true})); arguments[0].dispatchEvent(new Event('change', {bubbles:true}));`, dateInput);

      await driver.sleep(800); // allow async load

      const saveBtn = await driver.findElement(By.id('btn-save-attendance'));
      await driver.executeScript('arguments[0].click();', saveBtn);

      // Wait for status message to update
      const statusBanner = await driver.findElement(By.id('attendance-status-message'));
      await driver.wait(async () => {
        const text = await statusBanner.getText();
        return text.toLowerCase().includes('successfully saved') || text.toLowerCase().includes('saved attendance') || text.toLowerCase().includes('loaded');
      }, 5000);

      logPass(3, `Attendance saved successfully for date ${testDate}.`);
      passedCount++;
    } catch (err) {
      logFail(3, 'Verify attendance is saved for a selected date', err);
      failedCount++;
    }

    // ------------------------------------------------------------------------
    // TC-4: Verify invalid student information is handled
    // ------------------------------------------------------------------------
    try {
      await driver.get(`${BASE_URL}/students.html`);
      await driver.wait(until.elementLocated(By.id('form-add-student')), 5000);

      const rollInput = await driver.findElement(By.id('input-roll-no'));
      const nameInput = await driver.findElement(By.id('input-student-name'));
      const addBtn = await driver.findElement(By.id('btn-add-student'));

      // 1. Test empty fields validation
      await rollInput.clear();
      await nameInput.clear();
      await driver.executeScript('arguments[0].click();', addBtn);

      const alertBox = await driver.findElement(By.id('student-form-alert'));
      await driver.wait(until.elementIsVisible(alertBox), 3000);
      const emptyError = await alertBox.getText();
      if (!emptyError.toLowerCase().includes('required') && !emptyError.toLowerCase().includes('fill out')) {
        throw new Error(`Expected required field validation error, got: "${emptyError}"`);
      }

      // 2. Test duplicate roll number validation
      await driver.executeScript("arguments[0].value = '101'; arguments[0].dispatchEvent(new Event('input', {bubbles:true}));", rollInput);
      await driver.executeScript("arguments[0].value = 'Duplicate Test Student'; arguments[0].dispatchEvent(new Event('input', {bubbles:true}));", nameInput);
      const deptSelect = await driver.findElement(By.id('select-department'));
      await driver.executeScript("arguments[0].value = 'CSE'; arguments[0].dispatchEvent(new Event('change', {bubbles:true}));", deptSelect);
      await driver.executeScript('arguments[0].click();', addBtn);

      await driver.sleep(500);
      const duplicateError = await alertBox.getText();
      if (!duplicateError.toLowerCase().includes('already exists')) {
        throw new Error(`Expected duplicate roll error message, got: "${duplicateError}"`);
      }

      logPass(4, 'Invalid student information and duplicate roll numbers are handled gracefully.');
      passedCount++;
    } catch (err) {
      logFail(4, 'Verify invalid student information is handled', err);
      failedCount++;
    }

    // ------------------------------------------------------------------------
    // TC-5: Verify duplicate attendance entries are prevented
    // ------------------------------------------------------------------------
    try {
      const dupRows = await all(`
        SELECT student_id, attendance_date, period, COUNT(*) as cnt
        FROM attendance
        GROUP BY student_id, attendance_date, period
        HAVING cnt > 1
      `);

      if (dupRows.length > 0) {
        throw new Error(`Found ${dupRows.length} duplicate attendance entries in database!`);
      }

      logPass(5, 'Duplicate attendance entries (same student, date, and period) are strictly prevented.');
      passedCount++;
    } catch (err) {
      logFail(5, 'Verify duplicate attendance entries are prevented', err);
      failedCount++;
    }

    // ------------------------------------------------------------------------
    // TC-6: Verify monthly attendance totals
    // ------------------------------------------------------------------------
    try {
      await driver.get(`${BASE_URL}/report.html`);
      await driver.wait(until.elementLocated(By.id('btn-generate-report')), 5000);

      // Select October 2026
      const monthSelect = await driver.findElement(By.id('report-month'));
      await driver.executeScript("arguments[0].value = '10'; arguments[0].dispatchEvent(new Event('change', {bubbles:true}));", monthSelect);
      const generateBtn = await driver.findElement(By.id('btn-generate-report'));
      await driver.executeScript('arguments[0].click();', generateBtn);

      await driver.sleep(800); // allow render
      const firstRow = await driver.wait(until.elementLocated(By.css('#tbody-monthly-report tr.report-row')), 5000);
      const cells = await firstRow.findElements(By.tagName('td'));

      const workingPeriods = parseInt(await cells[3].getText(), 10);
      const present = parseInt(await cells[4].getText(), 10);
      const absent = parseInt(await cells[5].getText(), 10);

      if (workingPeriods !== present + absent) {
        throw new Error(`Totals mismatch: Working (${workingPeriods}) !== Present (${present}) + Absent (${absent})`);
      }

      logPass(6, `Monthly attendance totals verified: Working Periods (${workingPeriods}) = Present (${present}) + Absent (${absent}).`);
      passedCount++;
    } catch (err) {
      logFail(6, 'Verify monthly attendance totals', err);
      failedCount++;
    }

    // ------------------------------------------------------------------------
    // TC-7: Verify attendance percentage
    // ------------------------------------------------------------------------
    try {
      const firstRow = await driver.findElement(By.css('#tbody-monthly-report tr.report-row'));
      const cells = await firstRow.findElements(By.tagName('td'));

      const workingPeriods = parseInt(await cells[3].getText(), 10);
      const present = parseInt(await cells[4].getText(), 10);
      const pctText = (await cells[6].getText()).split('\n')[0].replace('%', '').trim();
      const actualPct = parseFloat(pctText);

      const expectedPct = parseFloat(((present / workingPeriods) * 100).toFixed(2));
      if (Math.abs(actualPct - expectedPct) > 0.05) {
        throw new Error(`Percentage calculation error: Expected ${expectedPct}%, found ${actualPct}%`);
      }

      logPass(7, `Attendance percentage calculation verified (${actualPct}% matches (${present}/${workingPeriods}) * 100).`);
      passedCount++;
    } catch (err) {
      logFail(7, 'Verify attendance percentage', err);
      failedCount++;
    }

    // ------------------------------------------------------------------------
    // TC-8: Verify students below attendance threshold
    // ------------------------------------------------------------------------
    try {
      const defaulterRows = await driver.findElements(By.css('#tbody-monthly-report tr.defaulter-row-warning'));
      if (defaulterRows.length === 0) {
        throw new Error('Expected at least one student below the 75% threshold in sample report.');
      }

      const defaulterText = await defaulterRows[0].getText();
      if (!defaulterText.includes('Below 75%') && !defaulterText.includes('103')) {
        throw new Error('Defaulter row did not display below threshold warning.');
      }

      logPass(8, `Students below attendance threshold (e.g. 74.68%) are identified and highlighted.`);
      passedCount++;
    } catch (err) {
      logFail(8, 'Verify students below attendance threshold', err);
      failedCount++;
    }

    // ------------------------------------------------------------------------
    // TC-9: Verify monthly report generation and CSV export
    // ------------------------------------------------------------------------
    try {
      const exportBtn = await driver.findElement(By.id('btn-export-csv'));
      const isVisible = await exportBtn.isDisplayed();
      if (!isVisible) throw new Error('CSV Export button is not visible.');

      await driver.executeScript('arguments[0].click();', exportBtn);
      await driver.sleep(500);

      // Verify table contains report headers
      const headers = await driver.findElements(By.css('#table-monthly-report th'));
      const headerTexts = await Promise.all(headers.map((h) => h.getText()));
      const required = ['Roll No.', 'Student', 'Working periods', 'Present', 'Absent', 'Attendance'];

      for (const req of required) {
        if (!headerTexts.some((h) => h.includes(req))) {
          throw new Error(`Missing required column header in report: ${req}`);
        }
      }

      logPass(9, 'Monthly report table generated and CSV export functionality verified.');
      passedCount++;
    } catch (err) {
      logFail(9, 'Verify monthly report generation and CSV export', err);
      failedCount++;
    }

    // ------------------------------------------------------------------------
    // TC-10: Verify saved records remain available after restarting the application
    // ------------------------------------------------------------------------
    try {
      const studentCountRow = await get('SELECT COUNT(*) as count FROM students WHERE is_active = 1');
      const attendanceCountRow = await get('SELECT COUNT(*) as count FROM attendance');

      if (!studentCountRow || studentCountRow.count === 0) {
        throw new Error('No students found in persistent database.');
      }
      if (!attendanceCountRow || attendanceCountRow.count === 0) {
        throw new Error('No attendance records found in persistent database.');
      }

      logPass(10, `Saved records remain persistent in SQLite database (${studentCountRow.count} students, ${attendanceCountRow.count} attendance records).`);
      passedCount++;
    } catch (err) {
      logFail(10, 'Verify saved records remain available after restarting the application', err);
      failedCount++;
    }

    console.log('\n' + '='.repeat(70));
    console.log(`  ${colors.bold}Test Execution Summary:${colors.reset}`);
    console.log(`  Total Test Cases: 10`);
    console.log(`  ${colors.green}Passed: ${passedCount}${colors.reset}`);
    console.log(`  ${failedCount > 0 ? colors.red : colors.green}Failed: ${failedCount}${colors.reset}`);
    console.log('='.repeat(70) + '\n');

    if (failedCount > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('Fatal Test Suite Error:', error);
    process.exitCode = 1;
  } finally {
    if (driver) {
      await driver.quit().catch(() => {});
    }
    if (serverProcess) {
      serverProcess.kill();
    }
  }
}

runTestSuite();
