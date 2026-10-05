FROM node:20-alpine

WORKDIR /app

# Копируем зависимости
COPY package*.json ./

# Устанавливаем production зависимости
RUN npm ci --omit=dev

# Копируем исходный код
COPY . .

# Экспонируем порт
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["npm", "start"]
