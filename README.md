# Travel Companion

<p align="center">
  <img src="https://github.com/user-attachments/assets/515e3214-7574-4dbf-923c-fe1c01fb9232" width="70%" />
</p>

<p align="center">
  <img src="https://github.com/user-attachments/assets/e130ec8e-dc98-4d90-ab6d-bfd6b82f6a0d" width="70%" />
</p>

<p align="center">
  <img src="https://github.com/user-attachments/assets/cc624d9e-9b89-4e26-adc4-3c8d10588e89" width="30%" />
  <img src="https://github.com/user-attachments/assets/9bc918e1-c599-4d20-bcbb-9a8657966dcc" width="30%" />
</p>

## Overview

Travel Companion allows you to manage every aspect of your travel, from transportation and lodging to daily activities and checklists. It features real-time collaboration, budget tracking, and offline support, making it the perfect tool for solo travelers and groups alike.

## Key Features

*   **Trip Management**: Create detailed itineraries with drag-and-drop organization using the timeline view.
*   **Collaborative Planning**: Share trips with friends and family with granular permission controls (View/Edit).
*   **Budget & Expenses**: Track spending in real-time with multi-currency support and categorical breakdowns.
*   **Documents**: Store and link PDF tickets, reservations, and files directly to trip items.
*   **Offline Mode**: Access your full itinerary and saved documents without an internet connection.
*   **Brainstorming**: A collaborative canvas for ideas, notes, and locations before the plan is finalized.
*   **Calendar**: Visual overview of all your upcoming trips.
*   **Mobile Friendly**: Fully responsive design with a dedicated mobile experience, including map integration.

## Technical Stack

*   **Frontend**: React, Tailwind CSS, Zustand
*   **Backend**: Node.js, Express
*   **Database**: SQLite
*   **Infrastructure**: Docker

## Getting Started

### Using Docker (Recommended)

1.  Clone the repository.
2.  Configure your environment variables in `docker-compose.yml` or create an `.env` file.
3.  Run the start script:
    ```bash
    ./start.sh
    ```
    The application will be accessible at `http://localhost:5000`.

### Local Development

1.  Install dependencies:
    ```bash
    npm run install-all
    ```
2.  Create a `.env` file in the **server** directory (or root, depending on setup) with the required variables.
3.  Start the development server:
    ```bash
    npm run dev
    ```
    *   Frontend: `http://localhost:3000`
    *   Backend: `http://localhost:5000`

## Configuration

To run the application, you must configure the following environment variables.

### General

| Variable | Description | Default | Required |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Environment mode (`production` or `development`) | `development` | No |
| `PORT` | Port for the backend server | `5000` | No |
| `JWT_SECRET` | Secret key for session signing | - | **Yes** |
| `FRONTEND_URL` | Public URL of the app (used in emails) | - | **Yes** |

### Email Service (SMTP)

Required for sending invitations and trip updates.

| Variable | Description | Example |
| :--- | :--- | :--- |
| `EMAIL_HOST` | SMTP server hostname | `smtp.gmail.com` |
| `EMAIL_PORT` | SMTP port | `587` or `465` |
| `EMAIL_USER` | SMTP username | `user@gmail.com` |
| `EMAIL_PASS` | SMTP password or App Password | `secret` |
| `EMAIL_FROM` | Sender address | `Traveler <noreply@app.com>` |
| `EMAIL_QUEUE_DURATION_MS` | Batch email notification delay (ms) | `3600000` (1hr) |
| `EMAIL_PROCESS_INTERVAL_MS` | Notification processing interval (ms) | `300000` (5min) |

### Client / Frontend

These variables must be available at build time (or runtime for Docker).

| Variable | Description | Required |
| :--- | :--- | :--- |
| `VITE_MAPBOX_TOKEN` | Mapbox public token for map views | **Yes** (if using maps) |
| `VITE_API_URL` | Backend API URL (for local dev) | No (defaults to `/api`) |

## License

MIT License.