# Travel Companion App

A full-featured travel planning application built with React, Node.js, and SQLite.

![image](https://github.com/user-attachments/assets/66e2762b-0b4a-4479-8fef-f8fb81880b61)

![image](https://github.com/user-attachments/assets/ba9da10d-6c1e-4bd8-bfec-c989f71fadb8)

![image](https://github.com/user-attachments/assets/c5ff27e1-255d-428e-ac5c-46d81375decf)

## ⚠️ Disclaimer / AI-Generated Project Warning

**This project was mostly coded using AI (Claude 3.7 Sonnet Thinking).**

This code is provided as-is. While effort has been made to ensure functionality, it comes with no warranty or guarantee of support.

**Please note:**

- Use of this code is at your own risk.
- No official support will be provided for setup, usage, customization, or troubleshooting.
- Community contributions and improvements via pull requests are welcome, but please do not expect personalized assistance.

For any issues or questions, consider consulting online resources, community forums, or attempting to resolve problems independently.

## Features

- **Trip Management**: Create, edit, and delete trips with details
- **Transportation Tracking**: Log flights, trains, buses, and other transportation
- **Accommodation Management**: Keep track of hotels and other lodging
- **Activity Planning**: Plan activities and excursions
- **Document Storage**: Store tickets, reservations, and other important documents
- **Trip Sharing**: Share trips with others and manage permissions
- **Calendar View**: See all your travel plans in a calendar view

## Tech Stack

- **Frontend**: React, Tailwind CSS, Zustand for state management
- **Backend**: Node.js, Express
- **Database**: SQLite (with better-sqlite3)
- **Authentication**: JWT
- **File Storage**: Local filesystem
- **Containerization**: Docker

## Getting Started

### Prerequisites

- Docker and Docker Compose

### Production Setup

This application is configured for production use with:

- React frontend built as static files and served by Express
- Node.js backend running in production mode
- Data persistence through host system folder mapping
- All services run through a single port (5000)
- Security headers enabled

All data (uploads and database) is persisted in the `./data` directory, making backups and migration simpler.

### Running with Docker

This application can run in both development and production modes with data persistence through host system folders.

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/travel-companion.git
   cd travel-companion
   ```

2. Make the start script executable:
   ```
   chmod +x start.sh
   ```

3. Start the application:
   
   **Development Mode** (with hot reloading):
   ```
   ./start.sh --development
   ```
   
   The application will be available at:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

   **Production Mode**:
   ```
   ./start.sh
   ```
   or
   ```
   ./start.sh --production
   ```
   
   The application will be available at:
   - http://localhost:5000 (Server handles both frontend and API)

### Running without Docker

1. Install dependencies:
   ```
   npm run install-all
   ```

2. Start the development server:
   ```
   npm run dev
   ```

## Project Structure

```
traveler/
├── client/               # React frontend
│   ├── public/           # Static assets
│   └── src/              # Source code
│       ├── components/   # UI components
│       ├── layouts/      # Layout components
│       ├── pages/        # Page components
│       ├── services/     # API services
│       └── stores/       # Zustand state stores
├── server/               # Node.js backend
│   ├── controllers/      # Route controllers
│   ├── db/               # Database setup
│   ├── middleware/       # Express middleware
│   ├── routes/           # API routes
│   ├── uploads/          # File uploads storage
│   └── utils/            # Utility functions
└── docker-compose.yml    # Docker configuration
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login a user
- `GET /api/auth/me` - Get current user information

### Trips
- `GET /api/trips` - Get all user trips
- `GET /api/trips/:tripId` - Get a single trip
- `POST /api/trips` - Create a new trip
- `PUT /api/trips/:tripId` - Update a trip
- `DELETE /api/trips/:tripId` - Delete a trip
- `POST /api/trips/:tripId/share` - Share a trip with another user

### Transportation
- `GET /api/transportation/trip/:tripId` - Get all transportation for a trip
- `POST /api/transportation/trip/:tripId` - Add transportation to a trip
- `PUT /api/transportation/:transportId` - Update transportation
- `DELETE /api/transportation/:transportId` - Delete transportation

### Lodging
- `GET /api/lodging/trip/:tripId` - Get all lodging for a trip
- `POST /api/lodging/trip/:tripId` - Add lodging to a trip
- `PUT /api/lodging/:lodgingId` - Update lodging
- `DELETE /api/lodging/:lodgingId` - Delete lodging

### Activities
- `GET /api/activities/trip/:tripId` - Get all activities for a trip
- `POST /api/activities/trip/:tripId` - Add activity to a trip
- `PUT /api/activities/:activityId` - Update activity
- `DELETE /api/activities/:activityId` - Delete activity

### Documents
- `POST /api/documents` - Upload a document
- `GET /api/documents/:documentId` - Get document metadata
- `GET /api/documents/:documentId/download` - Download a document
- `DELETE /api/documents/:documentId` - Delete a document

## Future Enhancements

- Travel budget tracking
- Weather forecasts for destinations
- Map integration

## License

This project is licensed under the MIT License - see the LICENSE file for details.
