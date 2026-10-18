FROM node:24-alpine
WORKDIR /app
COPY package.json /app
COPY yarn.lock /app
RUN yarn install --frozen-lockfile && yarn cache clean
COPY . /app
CMD yarn run serve --host
EXPOSE 8080
