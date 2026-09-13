FROM node:24-alpine
WORKDIR /app
COPY server.js index.html ./
ENV PORT=80 DB_PATH=/data/scores.db NODE_ENV=production
EXPOSE 80
CMD ["node", "server.js"]
