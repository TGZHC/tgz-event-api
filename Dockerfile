# Small, production-only image. Railway can build from this or from Nixpacks;
# this gives you reproducible builds and a pinned Node version.
FROM node:20-alpine

WORKDIR /app

# Install prod deps first for better layer caching.
COPY package.json ./
RUN npm install --omit=dev

COPY src ./src
COPY public ./public
COPY messages.json ./messages.json

ENV NODE_ENV=production
EXPOSE 3000

# Railway sets PORT; config.js reads it.
CMD ["node", "src/index.js"]
