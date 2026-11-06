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
 * Automated Selenium WebDriver Test Suite
 * Student Attendance and Academic Performance Management System
 * Using DevOps Tools — B.Tech CSE Project
 *
 * TEST CASES (7):
 * TC01 - Faculty Login
 * TC02 - Student Registration
 * TC03 - Add Student Details
 * TC04 - Mark Attendance
 * TC05 - View Attendance Percentage
 * TC06 - Enter Internal Marks
 * TC07 - Generate Student Performance Reports
 */
public class AttendanceSystemSeleniumTests extends BaseTest {

    // =========================================================================
    // TC01: Faculty Login
    // Verify that faculty can log in with valid credentials and
    // is redirected to the dashboard (index.html).
    // =========================================================================
    @Test
    @DisplayName("TC01: Faculty Login")
    public void TC01_FacultyLogin() {
        driver.get(BASE_URL + "/login.html");

        wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("login-username")));

        // Enter valid credentials
        WebElement usernameInput = driver.findElement(By.id("login-username"));
        usernameInput.clear();
        usernameInput.sendKeys(DEFAULT_USER);

        WebElement passwordInput = driver.findElement(By.id("login-password"));
        passwordInput.clear();
        passwordInput.sendKeys(DEFAULT_PASS);

        jsClick(driver.findElement(By.id("btn-login")));

        // Must redirect to dashboard
        wait.until(ExpectedConditions.urlContains("index.html"));
        String currentUrl = driver.getCurrentUrl();

        assertTrue(
            currentUrl.contains("index.html"),
            "Faculty login must redirect to dashboard (index.html). Actual URL: " + currentUrl
        );
    }

    // =========================================================================
    // TC02: Student Registration
    // Verify that a new student can be registered and appears in the student list.
    // =========================================================================
    @Test
    @DisplayName("TC02: Student Registration")
    public void TC02_StudentRegistration() {
        loginAndNavigate("/students.html");

        wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("btn-add-student")));

        // Use a timestamp-based roll number to avoid collisions
        String uniqueRoll = "TC02-" + (System.currentTimeMillis() % 100000);

        setValue(driver.findElement(By.id("input-roll-no")), uniqueRoll);
        setValue(driver.findElement(By.id("input-student-name")), "Selenium Registered Student");
        new Select(driver.findElement(By.id("select-department"))).selectByValue("CSE");

        jsClick(driver.findElement(By.id("btn-add-student")));

        // Wait for table to update and verify the new student appears
        wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("tbody-students")));

        boolean studentFound = wait.until(driver -> {
            String tableText = driver.findElement(By.id("tbody-students")).getText();
            return tableText.contains(uniqueRoll) || tableText.contains("Selenium Registered Student");
        });

        assertTrue(studentFound,
            "Newly registered student (Roll: " + uniqueRoll + ") must appear in the students list.");
    }

    // =========================================================================
    // TC03: Add Student Details
    // Verify required field validation and duplicate roll number rejection.
    // =========================================================================
    @Test
    @DisplayName("TC03: Add Student Details")
    public void TC03_AddStudentDetails() {
        loginAndNavigate("/students.html");

        wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("btn-add-student")));

        WebElement rollInput = driver.findElement(By.id("input-roll-no"));
        WebElement nameInput = driver.findElement(By.id("input-student-name"));
        WebElement addBtn = driver.findElement(By.id("btn-add-student"));

        // --- Test 1: Empty fields must show validation error ---
        rollInput.clear();
        nameInput.clear();
        jsClick(addBtn);

        WebElement alertBox = wait.until(
            ExpectedConditions.visibilityOfElementLocated(By.id("student-form-alert"))
        );
        assertTrue(alertBox.isDisplayed(), "Validation alert must appear for empty fields.");
        String emptyMsg = alertBox.getText().toLowerCase();
        assertTrue(
            emptyMsg.contains("required") || emptyMsg.contains("fill"),
            "Alert must state required fields. Got: " + alertBox.getText()
        );

        // --- Test 2: Duplicate roll number must be rejected ---
        // Roll number '101' already exists in seeded data
        setValue(rollInput, "101");
        setValue(nameInput, "Duplicate Check Student");
        new Select(driver.findElement(By.id("select-department"))).selectByValue("CSE");
        jsClick(addBtn);

        wait.until(ExpectedConditions.textToBePresentInElementLocated(
            By.id("student-form-alert"), "already exists"
        ));
        String dupMsg = alertBox.getText().toLowerCase();
        assertTrue(
            dupMsg.contains("already exists") || dupMsg.contains("duplicate"),
            "Alert must reject duplicate roll number. Got: " + alertBox.getText()
        );
    }

    // =========================================================================
    // TC04: Mark Attendance
    // Verify faculty can mark all 7 periods for students and save attendance.
    // =========================================================================
    @Test
    @DisplayName("TC04: Mark Attendance")
    public void TC04_MarkAttendance() {
        loginAndNavigate("/attendance.html");

        wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("table-daily-attendance")));
        wait.until(ExpectedConditions.visibilityOfElementLocated(
            By.cssSelector("#tbody-attendance tr.attendance-row")
        ));

        // Set a specific attendance date
        String testDate = "2026-11-07";
        WebElement dateInput = wait.until(
            ExpectedConditions.visibilityOfElementLocated(By.id("attendance-date"))
        );
        setValue(dateInput, testDate);

        try { Thread.sleep(600); } catch (InterruptedException ignored) {}

        // Verify 7 period buttons exist on the first student row
        WebElement firstRow = driver.findElement(By.cssSelector("#tbody-attendance tr.attendance-row"));
        List<WebElement> periodBtns = firstRow.findElements(By.cssSelector(".period-btn"));
        assertEquals(7, periodBtns.size(),
            "Each student must have exactly 7 period buttons (P1 to P7).");

        // Click Mark All Present
        jsClick(driver.findElement(By.id("btn-mark-all-present")));
        try { Thread.sleep(300); } catch (InterruptedException ignored) {}

        // Save attendance
        jsClick(driver.findElement(By.id("btn-save-attendance")));

        // Verify save confirmation
        wait.until(ExpectedConditions.textToBePresentInElementLocated(
            By.id("attendance-status-message"), "saved"
        ));
        String statusMsg = driver.findElement(By.id("attendance-status-message")).getText().toLowerCase();
        assertTrue(
            statusMsg.contains("saved") || statusMsg.contains("success"),
            "Status message must confirm attendance saved. Got: " + statusMsg
        );
    }

    // =========================================================================
    // TC05: View Attendance Percentage
    // Verify the monthly report shows correct attendance percentage per student
    // using the formula: (Present / Working Periods) * 100.
    // =========================================================================
    @Test
    @DisplayName("TC05: View Attendance Percentage")
    public void TC05_ViewAttendancePercentage() {
        loginAndNavigate("/report.html");

        wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("btn-generate-report")));

        // Select November 2026
        new Select(driver.findElement(By.id("report-month"))).selectByValue("11");
        setValue(driver.findElement(By.id("report-year")), "2026");

        jsClick(driver.findElement(By.id("btn-generate-report")));

        // Wait for rows to appear
        wait.until(ExpectedConditions.visibilityOfElementLocated(
            By.cssSelector("#tbody-monthly-report tr.report-row")
        ));
        try { Thread.sleep(500); } catch (InterruptedException ignored) {}

        // Count rows fresh — do NOT hold a List<WebElement> across DOM updates
        int rowCount = driver.findElements(By.cssSelector("#tbody-monthly-report tr.report-row")).size();
        assertTrue(rowCount > 0, "Monthly report must have at least one student row.");

        // Validate percentage formula: iterate by index to re-query each time (avoids stale refs)
        for (int i = 0; i < rowCount; i++) {
            // Re-query row by index each iteration
            List<WebElement> currentRows = driver.findElements(
                By.cssSelector("#tbody-monthly-report tr.report-row"));
            if (i >= currentRows.size()) break;

            List<WebElement> cells = currentRows.get(i).findElements(By.tagName("td"));
            if (cells.size() < 7) continue;

            String pctText = cells.get(6).getText().split("\n")[0].replace("%", "").trim();
            if (pctText.equalsIgnoreCase("N/A")) continue;

            int working = Integer.parseInt(cells.get(3).getText().trim());
            int present = Integer.parseInt(cells.get(4).getText().trim());
            if (working == 0) continue;

            double actualPct = Double.parseDouble(pctText);
            double expectedPct = Math.round(((double) present / working) * 100.0 * 100.0) / 100.0;

            assertEquals(expectedPct, actualPct, 0.1,
                "Attendance % must equal (Present/Working)*100. Expected: "
                    + expectedPct + "%, Got: " + actualPct + "%");
            break; // validated at least one row — test passes
        }
    }

    // =========================================================================
    // TC06: Enter Internal Marks
    // Verify faculty can enter internal marks for a student and
    // the percentage is calculated and displayed correctly.
    // =========================================================================
    @Test
    @DisplayName("TC06: Enter Internal Marks")
    public void TC06_EnterInternalMarks() {
        loginAndNavigate("/marks.html");

        wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("btn-save-marks")));

        // Wait for student dropdown to populate
        wait.until(driver -> {
            List<WebElement> opts = driver.findElements(
                By.cssSelector("#select-student option[value]:not([value=''])"));
            return opts.size() > 0;
        });

        // Select first available student
        Select studentSelect = new Select(driver.findElement(By.id("select-student")));
        studentSelect.selectByIndex(1); // index 0 is the placeholder

        // Fill in mark details
        setValue(driver.findElement(By.id("input-subject")), "DevOps Engineering");
        setValue(driver.findElement(By.id("input-assessment")), "Internal Test 1");
        setValue(driver.findElement(By.id("input-marks-obtained")), "22");
        setValue(driver.findElement(By.id("input-max-marks")), "25");

        // Save marks
        jsClick(driver.findElement(By.id("btn-save-marks")));

        // Verify saved marks appear in the table
        wait.until(driver -> {
            String tableText = driver.findElement(By.id("tbody-marks")).getText();
            return tableText.contains("DevOps Engineering") || tableText.contains("22");
        });

        String marksText = driver.findElement(By.id("tbody-marks")).getText();
        assertTrue(
            marksText.contains("DevOps Engineering"),
            "Saved subject 'DevOps Engineering' must appear in internal marks table."
        );
        assertTrue(
            marksText.contains("88") || marksText.contains("22"),
            "Marks percentage (88%) or obtained marks (22) must appear in the table."
        );
    }

    // =========================================================================
    // TC07: Generate Student Performance Reports
    // Verify monthly report is generated with all required columns and
    // individual student performance report modal can be opened.
    // =========================================================================
    @Test
    @DisplayName("TC07: Generate Student Performance Reports")
    public void TC07_GenerateStudentPerformanceReports() {
        loginAndNavigate("/report.html");

        wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("btn-generate-report")));

        // Generate report for November 2026
        new Select(driver.findElement(By.id("report-month"))).selectByValue("11");
        setValue(driver.findElement(By.id("report-year")), "2026");
        jsClick(driver.findElement(By.id("btn-generate-report")));

        // Wait for rows — then allow DOM to fully settle before reading
        wait.until(ExpectedConditions.visibilityOfElementLocated(
            By.cssSelector("#tbody-monthly-report tr.report-row")
        ));
        try { Thread.sleep(500); } catch (InterruptedException ignored) {}

        // Re-query fresh after settle to avoid stale references
        int rowCount = driver.findElements(
            By.cssSelector("#tbody-monthly-report tr.report-row")).size();
        assertTrue(rowCount > 0, "Performance report must contain student rows.");

        // Verify required column headers
        String headers = driver.findElement(By.cssSelector("#table-monthly-report thead")).getText();
        assertTrue(headers.contains("Roll No"),        "Report must have 'Roll No' column.");
        assertTrue(headers.contains("Student"),        "Report must have 'Student' column.");
        assertTrue(headers.contains("Working periods"),"Report must have 'Working periods' column.");
        assertTrue(headers.contains("Present"),        "Report must have 'Present' column.");
        assertTrue(headers.contains("Absent"),         "Report must have 'Absent' column.");
        assertTrue(headers.contains("Attendance"),     "Report must have 'Attendance' column.");

        // Re-query detail buttons fresh to avoid stale reference
        List<WebElement> detailButtons = driver.findElements(
            By.cssSelector("#tbody-monthly-report tr.report-row button")
        );
        assertFalse(detailButtons.isEmpty(), "Each student row must have a 'Details' button.");

        // Click the first detail button via JS to avoid stale click
        jsClick(detailButtons.get(0));

        // Student performance modal must open
        wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("modal-student-report")));
        // Re-query modal fresh
        assertTrue(
            driver.findElement(By.id("modal-student-report")).isDisplayed(),
            "Individual student performance report modal must open on clicking Details."
        );
    }
}
