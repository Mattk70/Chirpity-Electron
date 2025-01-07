# Use a base image with Node.js and Chromium
FROM debian:bullseye-slim

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    xvfb \
    libgtk-3-0 \
    libnotify4 \
    libnss3 \
    libxss1 \
    libxtst6 \
    libasound2 \
    libx11-xcb1 \
    libgbm1 \
    x11-utils \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs

# Copy your app files
WORKDIR /app
COPY . /app

# Install app dependencies
RUN npm install

# Set environment variables if needed
ENV DISPLAY=:99

# Start the app
CMD ["npm", "start", "--", "--no-sandbox"]

