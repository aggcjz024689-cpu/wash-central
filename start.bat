@echo off
title Wash Central Server
echo ========================================
echo Wash Central Server - Запуск
echo ========================================
echo.

if not exist .env (
    echo [ОШИБКА] Файл .env не найден!
    echo Скопируйте .env.example в .env и отредактируйте его
    pause
    exit /b 1
)

echo Запуск сервера...
npm start
pause
