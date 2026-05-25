#!/bin/bash

# Kill both processes when Ctrl+C is pressed
trap "kill 0" EXIT

echo "🔥 Starting Backend..."
uvicorn backend.main:app --reload --port 8000 &

echo "⚡ Starting Frontend..."
cd frontend && npm run dev &

wait
