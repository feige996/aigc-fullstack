FROM node:22-alpine AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/shared-contracts/package.json ./packages/shared-contracts/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/admin/package.json ./apps/admin/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/ai-service/package.json ./apps/ai-service/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @aigc/shared-contracts build
RUN pnpm --filter @aigc/api prisma:generate
RUN pnpm --filter @aigc/api build

FROM node:22-alpine AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=build /repo/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /repo/apps/web/package.json ./apps/web/package.json
COPY --from=build /repo/apps/admin/package.json ./apps/admin/package.json
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build /repo/apps/ai-service/package.json ./apps/ai-service/package.json
COPY --from=build /repo/packages/shared-contracts/package.json ./packages/shared-contracts/package.json
COPY --from=build /repo/apps/api/prisma ./apps/api/prisma
COPY --from=build /repo/packages/shared-contracts/dist ./packages/shared-contracts/dist
COPY --from=build /repo/apps/api/dist ./apps/api/dist

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "apps/api/dist/main.js"]
