@echo off
echo ============================================
echo   BudgetBuddy Setup
echo ============================================
echo.

:: Check Node
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Download it from https://nodejs.org/
    pause
    exit /b 1
)
echo [OK] Node.js found

:: Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH.
    echo Download it from https://www.python.org/
    pause
    exit /b 1
)
echo [OK] Python found

:: Check npm
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed.
    pause
    exit /b 1
)
echo [OK] npm found

echo.
echo ============================================
echo   Setting up the app
echo ============================================
echo.

cd app

if not exist node_modules (
    echo Installing app dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
    echo Installing react-native-svg...
    call npx expo install react-native-svg
) else (
    echo [SKIP] node_modules already exists
)

if not exist .env (
    echo Creating app .env from template...
    copy .env.example .env
    echo [NOTE] Edit app\.env and fill in your sync server URL and token.
) else (
    echo [SKIP] app\.env already exists
)

cd ..

echo.
echo ============================================
echo   Setting up the sync server
echo ============================================
echo.

cd sync_server

if not exist venv (
    echo Creating Python virtual environment...
    python -m venv venv
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create venv.
        pause
        exit /b 1
    )
)
echo [OK] Virtual environment ready

echo Installing Python dependencies...
call venv\Scripts\pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] pip install failed.
    pause
    exit /b 1
)
echo [OK] Python dependencies installed

if not exist .env (
    echo Creating sync server .env from template...
    copy .env.example .env
    echo [NOTE] Edit sync_server\.env and fill in your database credentials and token.
) else (
    echo [SKIP] sync_server\.env already exists
)

cd ..

echo.
echo ============================================
echo   Setup complete!
echo ============================================
echo.
echo Next steps:
echo.
echo   1. Edit app\.env           - add your sync server URL and token
echo   2. Edit sync_server\.env   - add your MariaDB credentials and token
echo   3. Run the sync server:
echo        cd sync_server
echo        venv\Scripts\activate
echo        uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
echo.
echo   4. Start the app:
echo        cd app
echo        npx expo start
echo.
echo   5. (Optional) Start Cloudflare Tunnel for phone sync:
echo        cloudflared tunnel --url http://localhost:8000
echo.
pause