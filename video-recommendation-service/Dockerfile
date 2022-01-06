FROM node:17.3-alpine3.14

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --only=production

COPY ./src ./src

CMD npx wait-port rabbit:5672 && \
    npm start