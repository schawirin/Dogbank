# Stage 1: build
FROM node:18-alpine AS builder
WORKDIR /app

# só o package*.json para aproveitar cache
COPY package*.json ./
RUN npm ci

# agora copia o restante do código
COPY . .
# gera build de produção (usa devDependencies no build)
RUN npm run build

# Stage 2: runtime
FROM nginx:stable-alpine
# copia o build estático para o Nginx
COPY --from=builder /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
