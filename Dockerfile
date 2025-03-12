FROM node:20-slim

# Install dependencies required for building native modules
RUN apt-get update && apt-get install -y python3 make g++ sqlite3 libsqlite3-dev

WORKDIR /app

# Copy package.json and install dependencies for the root project
COPY package.json .
RUN npm install

# Copy server package.json and install dependencies
COPY server/package.json ./server/
RUN cd server && npm install --build-from-source

# Copy client package.json and install dependencies
COPY client/package.json ./client/
RUN cd client && npm install

# Copy the rest of the application code
COPY . .

# Rewrite .env for production
RUN printf 'VITE_API_URL=/api\nVITE_BASE_URL=' > ./client/.env

# Create needed directories
RUN mkdir -p server/uploads/documents server/uploads/trips server/uploads/profiles server/db/data

# Set permission for the uploads directory
RUN chmod -R 777 server/uploads server/db/data

# Build production frontend
RUN cd client && npm run build

# Expose only the backend port (will serve static frontend)
EXPOSE 5000

# Environment variables
ENV NODE_ENV=production

# Command to run the production app
CMD ["node", "server/index.js"]