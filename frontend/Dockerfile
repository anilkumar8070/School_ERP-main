FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build


FROM nginx:alpine

RUN rm -rf /usr/share/nginx/html/*

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]


#how to run locally?
#1) build locally : docker build -t frontend:latest .
#2) Run it locally: docker run -d -p 3000:80 --name frontend frontend:latest
#3) docker stop frontend
