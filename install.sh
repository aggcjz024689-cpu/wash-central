#!/bin/bash
echo "========================================"
echo "Wash Central Server - Установка"
echo "========================================"

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo "[ОШИБКА] Node.js не найден!"
    echo "Установите: sudo apt install nodejs npm"
    exit 1
fi

echo "[1/3] Node.js найден"
echo "[2/3] Установка зависимостей..."
npm install

echo "[3/3] Создание файла настроек..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "[ВНИМАНИЕ] Файл .env создан. Отредактируйте его"
fi

echo ""
echo "УСТАНОВКА ЗАВЕРШЕНА!"
echo "Далее: отредактируйте .env и запустите: npm start"
