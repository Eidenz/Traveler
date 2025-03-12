# Travel Companion App

A full-featured travel planning application built with React, Node.js, and SQLite.

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

### Running with Docker

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/travel-companion.git
   cd travel-companion
   ```

2. Build and run the containers:
   ```
   docker-compose up -d
   ```

3. The application will be available at:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

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

- Email notifications for trip updates and shared trips
- Integration with external travel APIs (flights, hotels)
- Mobile app with React Native
- Offline support
- Trip templates and suggestions
- Travel budget tracking
- Weather forecasts for destinations
- Map integration

## License

This project is licensed under the MIT License - see the LICENSE file for details.