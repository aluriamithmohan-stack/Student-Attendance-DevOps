package tests;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.Select;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Required Automated Selenium WebDriver Test Suite
 * Covers EXACTLY the 10 Necessary Test Cases defined in Project Specification:
 *
 * TC01: Verify attendance page displays all registered students.
 * TC02: Verify attendance can be marked for all seven periods.
 * TC03: Verify attendance is saved successfully for a selected date.
 * TC04: Verify missing or invalid student information is handled correctly.
 * TC05: Verify duplicate attendance entries are prevented (UPSERT).
 * TC06: Verify monthly attendance totals are calculated correctly.
 * TC07: Verify attendance percentage is displayed correctly.
 * TC08: Verify students below the configured attendance threshold are identified.
 * TC09: Verify monthly report can be generated and exported.
 * TC10: Verify saved records remain available after restart / persistence.
 */
public class AttendanceSystemSeleniumTests extends BaseTest {

    @Test
    @DisplayName("TC01: Verify attendance page displays all registered students")
    public void TC01_attendancePageDisplaysRegisteredStudents() {
        loginAndNavigate("/attendance.html");

        wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("tbody-attendance")));
        List<WebElement> rows = wait.until(ExpectedConditions.visibilityOfAllElementsLocatedBy(
            By.cssSelector("#tbody-attendance tr.attendance-row")));

        assertFalse(rows.isEmpty(), "Attendance table must display registered students");
        assertTrue(rows.size() >= 5, "Expected at least 5 registered active students");
    }

    @Test
    @DisplayName("TC02: Verify attendance can be marked for all seven periods")
    public void TC02_markAttendanceForAllSevenPeriods() {
        loginAndNavigate("/attendance.html");

        wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("btn-mark-all-present")));
        WebElement firstRow = wait.until(ExpectedConditions.visibilityOfElementLocated(
            By.cssSelector("#tbody-attendance tr.attendance-row")));

        List<WebElement> periodBtns = firstRow.findElements(By.cssSelector(".period-btn"));
        assertEquals(7, periodBtns.size(), "Each student row must provide exactly seven period buttons (P1 to P7)");

        // Click period 1 button to toggle
        WebElement p1Btn = periodBtns.get(0);
        String beforeToggle = p1Btn.getText().trim();
        jsClick(p1Btn);
        String afterToggle = p1Btn.getText().trim();
        assertNotEquals(beforeToggle, afterToggle, "Period button status should toggle between P and A on click");

        // Mark All Present
        jsClick(driver.findElement(By.id("btn-mark-all-present")));

        // Verify period buttons for first student row display 'P'
        firstRow = driver.findElement(By.cssSelector("#tbody-attendance tr.attendance-row"));
        periodBtns = firstRow.findElements(By.cssSelector(".period-btn"));
        for (int p = 0; p < 7; p++) {
            assertEquals("P", periodBtns.get(p).getText().trim(), "Period " + (p + 1) + " should be marked Present");
        }
    }

    @Test
    @DisplayName("TC03: Verify attendance is saved successfully for a selected date")
    public void TC03_saveAttendanceForSelectedDate() {
        loginAndNavigate("/attendance.html");

        String testDate = "2026-10-15";
        WebElement dateInput = wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("attendance-date")));
        setValue(dateInput, testDate);

        // Wait for attendance to load for the date
        wait.until(ExpectedConditions.textToBePresentInElementLocated(By.id("attendance-status-message"), testDate));

        // Click Save Attendance
        jsClick(driver.findElement(By.id("btn-save-attendance")));

        // Verify status message confirms save
        wait.until(ExpectedConditions.textToBePresentInElementLocated(By.id("attendance-status-message"), "successfully saved"));
        WebElement statusMsg = driver.findElement(By.id("attendance-status-message"));
        assertTrue(statusMsg.getText().contains("successfully saved"),
            "Status message should confirm attendance saved. Found: " + statusMsg.getText());
    }

    @Test
    @DisplayName("TC04: Verify missing or invalid student information is handled correctly")
    public void TC04_handleInvalidStudentInformationAndDuplicateRoll() {
        loginAndNavigate("/students.html");

        wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("btn-add-student")));

        // 1. Incomplete submission: leave roll and name empty
        driver.findElement(By.id("input-roll-no")).clear();
        driver.findElement(By.id("input-student-name")).clear();
        jsClick(driver.findElement(By.id("btn-add-student")));

        WebElement alert = wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("student-form-alert")));
        assertTrue(alert.isDisplayed(), "Validation error alert must be displayed for missing fields");
        assertTrue(alert.getText().toLowerCase().contains("required") || alert.getText().toLowerCase().contains("fill out"),
            "Alert text must indicate required fields");

        // 2. Duplicate roll number prevention: roll '101' already exists
        setValue(driver.findElement(By.id("input-roll-no")), "101");
        setValue(driver.findElement(By.id("input-student-name")), "Duplicate Test Student");
        new Select(driver.findElement(By.id("select-department"))).selectByValue("CSE");
        jsClick(driver.findElement(By.id("btn-add-student")));

        wait.until(ExpectedConditions.textToBePresentInElementLocated(By.id("student-form-alert"), "already exists"));
        assertTrue(alert.getText().toLowerCase().contains("already exists"),
            "Alert must reject duplicate roll number with descriptive error");
    }

    @Test
    @DisplayName("TC05: Verify duplicate attendance entries are prevented (UPSERT)")
    public void TC05_preventDuplicateAttendanceEntries() {
        loginAndNavigate("/attendance.html");

        String testDate = "2026-11-04";
        WebElement dateInput = wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("attendance-date")));
        setValue(dateInput, testDate);
        wait.until(ExpectedConditions.textToBePresentInElementLocated(By.id("attendance-status-message"), testDate));

        // Save first time
        jsClick(driver.findElement(By.id("btn-mark-all-present")));
        jsClick(driver.findElement(By.id("btn-save-attendance")));
        wait.until(ExpectedConditions.textToBePresentInElementLocated(By.id("attendance-status-message"), "successfully saved"));

        // Save second time on same date: must update in-place without duplicate constraint failure
        jsClick(driver.findElement(By.id("btn-save-attendance")));
        wait.until(ExpectedConditions.textToBePresentInElementLocated(By.id("attendance-status-message"), "successfully saved"));
        WebElement statusMsg = driver.findElement(By.id("attendance-status-message"));

        assertTrue(statusMsg.getText().contains("successfully saved"),
            "Repeated save must succeed cleanly via UPSERT without duplicate constraint errors");
    }

    @Test
    @DisplayName("TC06: Verify monthly attendance totals are calculated correctly")
    public void TC06_monthlyAttendanceTotalsCalculation() {
        loginAndNavigate("/report.html");

        new Select(driver.findElement(By.id("report-month"))).selectByValue("10");
        setValue(driver.findElement(By.id("report-year")), "2026");
        jsClick(driver.findElement(By.id("btn-generate-report")));

        wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("tbody-monthly-report")));
        List<WebElement> rows = wait.until(ExpectedConditions.visibilityOfAllElementsLocatedBy(
            By.cssSelector("#tbody-monthly-report tr.report-row")));
        assertFalse(rows.isEmpty(), "Monthly report must contain rows for October 2026");

        // Verify summary card working periods > 0
        WebElement workingPeriodsEl = driver.findElement(By.id("summary-working-periods"));
        int totalWorking = Integer.parseInt(workingPeriodsEl.getText().trim());
        assertTrue(totalWorking > 0, "Total working periods must be greater than zero");

        // Verify Working Periods = Present + Absent on rows
        for (WebElement row : rows) {
            List<WebElement> cells = row.findElements(By.tagName("td"));
            int working = Integer.parseInt(cells.get(3).getText().trim());
            int present = Integer.parseInt(cells.get(4).getText().trim());
            int absent = Integer.parseInt(cells.get(5).getText().trim());

            assertEquals(working, present + absent, "Working Periods must equal Present + Absent");
        }
    }

    @Test
    @DisplayName("TC07: Verify attendance percentage is displayed correctly")
    public void TC07_attendancePercentageCalculation() {
        loginAndNavigate("/report.html");

        new Select(driver.findElement(By.id("report-month"))).selectByValue("10");
        setValue(driver.findElement(By.id("report-year")), "2026");
        jsClick(driver.findElement(By.id("btn-generate-report")));

        wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("tbody-monthly-report")));
        List<WebElement> rows = wait.until(ExpectedConditions.visibilityOfAllElementsLocatedBy(
            By.cssSelector("#tbody-monthly-report tr.report-row")));

        for (WebElement row : rows) {
            List<WebElement> cells = row.findElements(By.tagName("td"));
            int working = Integer.parseInt(cells.get(3).getText().trim());
            int present = Integer.parseInt(cells.get(4).getText().trim());

            String pctText = cells.get(6).getText().split("\n")[0].replace("%", "").trim();
            if (!pctText.equalsIgnoreCase("N/A") && working > 0) {
                double actualPct = Double.parseDouble(pctText);
                double expectedPct = Math.round(((double) present / working) * 100.0 * 100.0) / 100.0;
                assertEquals(expectedPct, actualPct, 0.05,
                    "Attendance percentage must match formula: (Present / Working) * 100");
            }
        }
    }

    @Test
    @DisplayName("TC08: Verify students below the configured attendance threshold are identified")
    public void TC08_studentsBelowAttendanceThresholdIdentified() {
        loginAndNavigate("/report.html");

        new Select(driver.findElement(By.id("report-month"))).selectByValue("10");
        setValue(driver.findElement(By.id("report-year")), "2026");
        setValue(driver.findElement(By.id("report-threshold")), "75");
        jsClick(driver.findElement(By.id("btn-generate-report")));

        wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("tbody-monthly-report")));
        List<WebElement> rows = wait.until(ExpectedConditions.visibilityOfAllElementsLocatedBy(
            By.cssSelector("#tbody-monthly-report tr.report-row")));

        boolean foundDefaulter = false;
        for (WebElement row : rows) {
            List<WebElement> cells = row.findElements(By.tagName("td"));
            String pctText = cells.get(6).getText().split("\n")[0].replace("%", "").trim();
            if (!pctText.equalsIgnoreCase("N/A")) {
                double pct = Double.parseDouble(pctText);
                boolean hasBadge = row.getText().contains("Below 75%");
                if (pct < 75.0) {
                    assertTrue(hasBadge, "Student with " + pct + "% must be identified as Below 75%");
                    foundDefaulter = true;
                } else {
                    assertFalse(hasBadge, "Student with " + pct + "% must not be flagged");
                }
            }
        }
        assertTrue(foundDefaulter, "Report should identify at least one student below 75% threshold in sample data");
    }

    @Test
    @DisplayName("TC09: Verify monthly report can be generated and exported")
    public void TC09_monthlyReportCanBeGeneratedAndExported() {
        loginAndNavigate("/report.html");

        wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("tbody-monthly-report")));
        WebElement exportBtn = wait.until(ExpectedConditions.elementToBeClickable(By.id("btn-export-csv")));
        assertTrue(exportBtn.isDisplayed(), "Export as CSV button must be visible");

        jsClick(exportBtn);

        // Verify toast notification indicates download initiated
        WebElement toast = wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("toast")));
        assertTrue(toast.getText().toLowerCase().contains("downloading") || toast.getText().toLowerCase().contains("csv"),
            "Toast should indicate CSV export has started. Found: " + toast.getText());

        // Verify report table columns
        List<WebElement> headers = driver.findElements(By.cssSelector("#table-monthly-report th"));
        assertFalse(headers.isEmpty(), "Report table headers must be present");
        String allHeaders = driver.findElement(By.cssSelector("#table-monthly-report thead")).getText();
        assertTrue(allHeaders.contains("Roll No"), "Headers must contain Roll No");
        assertTrue(allHeaders.contains("Student"), "Headers must contain Student");
        assertTrue(allHeaders.contains("Working periods"), "Headers must contain Working periods");
        assertTrue(allHeaders.contains("Present"), "Headers must contain Present");
        assertTrue(allHeaders.contains("Absent"), "Headers must contain Absent");
        assertTrue(allHeaders.contains("Attendance"), "Headers must contain Attendance");
    }

    @Test
    @DisplayName("TC10: Verify saved records remain available after restart / persistence")
    public void TC10_savedRecordsRemainAvailableAfterRestart() {
        loginAndNavigate("/attendance.html");

        // Load October 15, 2026
        String persistDate = "2026-10-15";
        WebElement dateInput = wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("attendance-date")));
        setValue(dateInput, persistDate);

        // Verify loaded attendance records exist in persistent database
        wait.until(ExpectedConditions.textToBePresentInElementLocated(By.id("attendance-status-message"), persistDate));
        WebElement statusMsg = driver.findElement(By.id("attendance-status-message"));
        assertTrue(statusMsg.getText().contains("Loaded previously saved attendance") || statusMsg.getText().contains("records found"),
            "Attendance records must remain available and persistent in SQLite database");

        List<WebElement> rows = driver.findElements(By.cssSelector("#tbody-attendance tr.attendance-row"));
        assertTrue(rows.size() >= 5, "Attendance rows must persist and display");

        // Refresh browser to simulate restart/new session
        driver.navigate().refresh();
        dateInput = wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("attendance-date")));
        setValue(dateInput, persistDate);
        wait.until(ExpectedConditions.textToBePresentInElementLocated(By.id("attendance-status-message"), persistDate));

        statusMsg = driver.findElement(By.id("attendance-status-message"));
        assertTrue(statusMsg.getText().contains("Loaded previously saved attendance") || statusMsg.getText().contains("records found"),
            "Attendance records must remain persistent across page refreshes and restarts");
    }
}
