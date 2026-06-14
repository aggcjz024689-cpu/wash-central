@echo off
echo ========================================
echo Wash Central Server - Установка
echo ========================================
echo.

:: Проверка наличия Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ОШИБКА] Node.js не найден!
    echo Скачайте и установите Node.js с https://nodejs.org/
    pause
    exit /b 1
)

echo [1/3] Node.js найден
echo [2/3] Установка зависимостей...
call npm install

echo [3/3] Создание файла настроек...
if not exist .env (
    copy .env.example .env
    echo [ВНИМАНИЕ] Файл .env создан. Отредактируйте его: вставьте токен бота и свой Telegram ID
) else (
    echo [OK] Файл .env уже существует
)

echo.
echo ========================================
echo УСТАНОВКА ЗАВЕРШЕНА!
echo ========================================
echo.
echo ДАЛЕЕ:
echo 1. Отредактируйте файл .env (вставьте токен бота и свой Telegram ID)
echo 2. Запустите сервер: npm start  или  start.bat
echo.
pause
