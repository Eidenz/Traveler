FROM node:20-alpine

WORKDIR /app

# Copy package.json and install dependencies for the root project
COPY package.json .
RUN npm install

# Copy server package.json and install dependencies
COPY server/package.json ./server/
RUN cd server && npm install

# Copy client package.json and install dependencies
COPY client/package.json ./client/
RUN cd client && npm install

# Copy the rest of the application code
COPY . .

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