FROM node:18.17.1-slim

# Create project directory (workdir)
RUN mkdir /app
WORKDIR /app

# Add package.json to WORKDIR and install dependencies
COPY package.json .
COPY package-lock.json .
RUN npm install

# Add the remaining source code files to WORKDIR
COPY . .
RUN npm run build

# Start the application
CMD ["npm", "start"]