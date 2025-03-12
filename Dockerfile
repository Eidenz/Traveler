FROM node:20-alpine as build

WORKDIR /app

# Copy package.json and install dependencies for the root project
COPY package.json .
RUN npm install

# Copy server package.json and install dependencies
COPY server/package.json ./server/
RUN cd server && npm install --only=production

# Copy client package.json and install dependencies
COPY client/package.json ./client/
RUN cd client && npm install

# Copy the rest of the application code
COPY . .

# Build the React app for production
RUN cd client && npm run build

# Create a production image
FROM node:20-alpine

WORKDIR /app

# Copy package.json and install production dependencies
COPY package.json .
RUN npm install --only=production

# Copy server package.json and install production dependencies
COPY server/package.json ./server/
RUN cd server && npm install --only=production

# Copy built client and server
COPY --from=build /app/server ./server
COPY --from=build /app/client/dist ./client/dist

# Create needed directories
RUN mkdir -p server/uploads/documents server/uploads/trips server/uploads/profiles server/db/data

# Set permission for the uploads directory
RUN chmod -R 777 server/uploads server/db/data

# Expose only backend port (will serve static frontend)
EXPOSE 5000

# Environment variables
ENV NODE_ENV=production

# Command to run the production app
CMD ["node", "server/index.js"]