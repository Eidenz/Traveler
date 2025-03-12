#!/bin/bash

# Quick start script for Travel Companion app

# Create necessary directories
echo "Creating data directories..."
mkdir -p data/uploads/documents data/uploads/trips data/uploads/profiles data/db

# Set proper permissions
echo "Setting permissions..."
chmod -R 777 data

# Start the Docker container
echo "Starting Travel Companion app..."
docker-compose up -d

# Check if startup was successful
if [ $? -eq 0 ]; then
  echo "✅ Travel Companion app is running!"
  echo "🌐 Access the application at: http://localhost:5000"
else
  echo "❌ Failed to start Travel Companion app"
  exit 1
fi