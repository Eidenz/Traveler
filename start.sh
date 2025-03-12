#!/bin/bash

# Quick start script for Travel Companion app

# Default to development mode
MODE="prod"

# Parse command line arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        -p|--production) MODE="prod" ;;
        -d|--development) MODE="dev" ;;
        -h|--help) 
            echo "Usage: ./start.sh [-p|--production] [-d|--development] [-h|--help]"
            echo "  -p, --production    Start in production mode"
            echo "  -d, --development   Start in development mode (default)"
            echo "  -h, --help          Display this help message"
            exit 0
            ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

# Create necessary directories
echo "Creating data directories..."
mkdir -p data/uploads/documents data/uploads/trips data/uploads/profiles data/db

# Set proper permissions
echo "Setting permissions..."
chmod -R 777 data

# Start the Docker container in the requested mode
if [ "$MODE" == "prod" ]; then
    echo "Starting Travel Companion app in PRODUCTION mode..."
    docker-compose up -d --build
    
    # Check if startup was successful
    if [ $? -eq 0 ]; then
        echo "✅ Travel Companion app is running in PRODUCTION mode!"
        echo "🌐 Access the application at: http://localhost:5000"
    else
        echo "❌ Failed to start Travel Companion app in production mode"
        exit 1
    fi
else
    echo "Starting Travel Companion app in DEVELOPMENT mode..."
    npm run dev
    
    # Check if startup was successful
    if [ $? -eq 0 ]; then
        echo "✅ Travel Companion app is running in DEVELOPMENT mode!"
        echo "🌐 Access the application at:"
        echo "   - Frontend: http://localhost:3000"
        echo "   - Backend API: http://localhost:5000"
    else
        echo "❌ Failed to start Travel Companion app in development mode"
        exit 1
    fi
fi