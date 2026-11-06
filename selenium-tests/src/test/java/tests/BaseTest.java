package tests;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

public class BaseTest {
    protected WebDriver driver;
    protected WebDriverWait wait;
    public static final String BASE_URL = "http://localhost:3000";
    public static final String DEFAULT_USER = "faculty";
    public static final String DEFAULT_PASS = "password123";
    protected Path downloadDir;

    @BeforeEach
    public void setUp() throws IOException {
        downloadDir = Files.createTempDirectory("selenium_attendance_downloads_");

        ChromeOptions options = new ChromeOptions();
        options.addArguments("--headless=new");
        options.addArguments("--no-sandbox");
        options.addArguments("--disable-dev-shm-usage");
        options.addArguments("--disable-gpu");
        options.addArguments("--window-size=1920,1080");
        options.addArguments("--remote-allow-origins=*");

        Map<String, Object> prefs = new HashMap<>();
        prefs.put("download.default_directory", downloadDir.toAbsolutePath().toString());
        prefs.put("download.prompt_for_download", false);
        options.setExperimentalOption("prefs", prefs);

        driver = new ChromeDriver(options);
        wait = new WebDriverWait(driver, Duration.ofSeconds(10));
    }

    @AfterEach
    public void tearDown() {
        if (driver != null) {
            try {
                driver.quit();
            } catch (Exception ignored) {
            }
        }
    }

    protected void login() {
        driver.get(BASE_URL + "/login.html");
        wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("login-username")));
        
        WebElement usernameInput = driver.findElement(By.id("login-username"));
        usernameInput.clear();
        usernameInput.sendKeys(DEFAULT_USER);

        WebElement passwordInput = driver.findElement(By.id("login-password"));
        passwordInput.clear();
        passwordInput.sendKeys(DEFAULT_PASS);

        driver.findElement(By.id("btn-login")).click();

        // Wait for redirect to dashboard index.html
        wait.until(ExpectedConditions.or(
            ExpectedConditions.urlContains("index.html"),
            ExpectedConditions.visibilityOfElementLocated(By.id("stat-total-students"))
        ));
    }

    protected void loginAndNavigate(String relativePath) {
        login();
        driver.get(BASE_URL + relativePath);
    }

    protected void jsClick(WebElement element) {
        ((org.openqa.selenium.JavascriptExecutor) driver).executeScript("arguments[0].click();", element);
    }

    protected void setValue(WebElement element, String value) {
        ((org.openqa.selenium.JavascriptExecutor) driver).executeScript(
            "arguments[0].value = arguments[1]; arguments[0].dispatchEvent(new Event('input', { bubbles: true })); arguments[0].dispatchEvent(new Event('change', { bubbles: true }));",
            element, value);
    }
}
