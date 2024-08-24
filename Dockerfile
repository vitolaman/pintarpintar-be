FROM node:18.18.0-alpine AS development
WORKDIR /code
ENV NODE_ENV development
COPY --chown=node:node package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY --chown=node:node . .
USER node

FROM node:18.18.0-alpine AS build
WORKDIR /code
COPY --chown=node:node package.json yarn.lock ./
COPY --chown=node:node --from=development /code/node_modules ./node_modules
COPY --chown=node:node . .
RUN yarn run build
ENV NODE_ENV production
RUN yarn install --production --ignore-scripts --prefer-offline && yarn autoclean --force
USER node

FROM node:18.18.0-alpine AS production
WORKDIR /code
RUN mkdir -p /code/uploads && chown -R node:node /code/uploads
COPY --chown=node:node --from=build /code/package.json .
COPY --chown=node:node --from=build /code/node_modules ./node_modules
COPY --chown=node:node --from=build /code/dist ./dist
COPY --chown=node:node .env .env
USER node
ENV NODE_ENV development
ENTRYPOINT [ "node" ]
CMD [ "--max-old-space-size=200", "dist/main.js" ]