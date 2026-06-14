#!/bin/bash
echo "========================================"
echo "Wash Central Server - Запуск"
echo "========================================"

if [ ! -f .env ]; then
    echo "[ОШИБКА] Файл .env не найден!"
    exit 1
fi

npm start
