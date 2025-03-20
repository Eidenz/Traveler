# Travel Companion App

A full-featured travel planning application built with React, Node.js, and SQLite.

![image](https://github.com/user-attachments/assets/7e8bd62c-914e-4f4d-bc5e-8d7c55a5b440)

![image](https://github.com/user-attachments/assets/3687e797-69bf-45fc-a03b-561a3e775bfb)

![image](https://github.com/user-attachments/assets/95e1ecd8-4dd4-478e-b87f-010387f195d9)

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
- **Trip Checklists**: Create trip checklists to ensure everyone is ready for the journey
- **Calendar View**: See all your travel plans in a calendar view
- **Offline Support**: Access your trips and documents even when offline
- **Multilingual Support**: Available in multiple languages (English, French)
- **Dark Mode**: Full dark theme support for comfortable night-time usage
- **Mobile Responsive**: Fully responsive design for all device sizes
- **PDF Viewer**: Built-in viewer for PDF documents and tickets
- **User Profiles**: Edit profile, update password, and manage account
- **Real-time Permission Management**: Control sharing access levels (view/edit)

## Tech Stack

- **Frontend**: React 19, Tailwind CSS, Zustand for state management
- **Backend**: Node.js, Express
- **Database**: SQLite (with better-sqlite3)
- **Authentication**: JWT
- **File Storage**: Local filesystem
- **Containerization**: Docker
- **Internationalization**: i18next for multilingual support
- **Offline Storage**: IndexedDB for offline data persistence
- **Documents**: PDF support with built-in viewer

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

#### Please note that production mode requires HTTPS.

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

### User Management
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `PUT /api/users/password` - Change user password
- `DELETE /api/users/account` - Delete user account

### Trips
- `GET /api/trips` - Get all user trips
- `GET /api/trips/:tripId` - Get a single trip
- `POST /api/trips` - Create a new trip
- `PUT /api/trips/:tripId` - Update a trip
- `DELETE /api/trips/:tripId` - Delete a trip
- `POST /api/trips/:tripId/share` - Share a trip with another user
- `DELETE /api/trips/:tripId/members/:userId` - Remove a user from a trip

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
- `GET /api/documents/:documentId/view` - View a document
- `DELETE /api/documents/:documentId` - Delete a document
- `GET /api/documents/reference/:reference_type/:reference_id` - Get documents for a reference

## Offline Features

The application supports full offline functionality:
- Save trips for offline access
- View all trip details including transportation, lodging, and activities
- Access saved documents when offline
- Automatic offline mode detection
- Visual indicators for offline content

## Multilingual Support

The application includes multilingual support:
- English (default)
- French
- Language switcher in the user interface
- Automatic language detection based on browser settings

## License

This project is licensed under the MIT License - see the LICENSE file for details.
