@echo off
echo ========================================
echo Обновление кода с GitHub
echo ========================================
echo.

:: Сохраняем текущий .env
if exist .env copy .env .env.backup

:: Скачиваем последнюю версию
git pull

:: Восстанавливаем .env
if exist .env.backup (
    copy .env.backup .env
    del .env.backup
    echo [OK] Настройки сохранены
)

:: Обновляем зависимости
call npm install

echo.
echo [OK] Обновление завершено! Запустите start.bat
pause
