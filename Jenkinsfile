pipeline {
    agent any

    environment {
        APP_NAME     = 'student-attendance-devops'
        IMAGE_TAG    = "${env.BUILD_NUMBER ?: 'latest'}"
        PORT         = '3000'
        DOCKER_IMAGE = "${APP_NAME}:${IMAGE_TAG}"
    }

    stages {
        stage('1. Checkout SCM') {
            steps {
                echo '=== Checking out repository from Git ==='
                checkout scm
            }
        }

        stage('2. Install Dependencies') {
            steps {
                echo '=== Installing Node.js Dependencies ==='
                bat 'npm install'
            }
        }

        stage('3. Code Syntax & Database Verification') {
            steps {
                echo '=== Checking Node syntax and database initialization ==='
                bat 'node -c server.js'
                bat 'node -c database/db.js'
                bat 'node seed.js'
            }
        }

        stage('4. Docker Build') {
            steps {
                echo "=== Building Docker Image: ${DOCKER_IMAGE} ==="
                bat "docker build -t ${DOCKER_IMAGE} -t ${APP_NAME}:latest ."
            }
        }

        stage('5. Container Health Check') {
            steps {
                echo '=== Running container in isolated test environment ==='
                script {
                    // Stop any existing test container
                    bat 'docker rm -f attendance-test-container || exit 0'
                    // Run container detached
                    bat "docker run -d --name attendance-test-container -p 3001:3000 ${APP_NAME}:latest"
                    // Wait 5 seconds for Express to boot
                    sleep(time: 5, unit: 'SECONDS')
                    // Verify healthcheck endpoint
                    bat 'curl -f http://localhost:3001/api/dashboard'
                    // Cleanup test container
                    bat 'docker rm -f attendance-test-container'
                }
            }
        }

        stage('6. Selenium Automated Testing') {
            steps {
                echo '=== Executing Automated Selenium WebDriver Test Suite ==='
                // Run background server for tests if needed, or run against running container
                bat 'npm run test:selenium'
            }
        }
    }

    post {
        always {
            echo '=== Pipeline Execution Completed ==='
            // Ensure any running test container is stopped
            bat 'docker rm -f attendance-test-container || exit 0'
        }
        success {
            echo "✅ Build #${env.BUILD_NUMBER} Succeeded! Application is ready for Kubernetes deployment."
        }
        failure {
            echo "❌ Build #${env.BUILD_NUMBER} Failed! Check console log for details."
        }
    }
}
