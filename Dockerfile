FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm i --omit=dev
COPY . .
EXPOSE 8787
CMD ["npm","start"]
