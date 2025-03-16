FROM node:18-alpine

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Create directories for uploads and workflows
RUN mkdir -p uploads workflows

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD ["npm", "start"] 