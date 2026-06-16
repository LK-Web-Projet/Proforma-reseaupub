# ── Build ──────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci
RUN node -p "const p=require('./package.json'); (p.dependencies?.prisma || p.devDependencies?.prisma).replace(/^[\^~]/, '')" > /tmp/prisma-version

COPY . .

RUN npx prisma generate

ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

RUN npm run build

# ── Prisma CLI (isolé) ───────────────────────────────────────────────────────
# Installation propre du CLI Prisma seul, pour que npm résolve correctement
# ses dépendances transitives (ex. "effect" requis par @prisma/config) sans
# embarquer next/react/clerk ni les devDependencies du projet.
# Aucun package.json copié ici : sa présence forcerait npm à valider les peer
# deps de tout le projet (react/next/clerk) et casserait l'install isolée.
FROM node:20-alpine AS prisma-cli
WORKDIR /prisma
COPY --from=builder /tmp/prisma-version ./prisma-version
RUN npm install --no-save prisma@$(cat prisma-version)

# ── Runner ─────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma CLI pour migrations au démarrage (deps résolues isolément, voir stage prisma-cli)
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=prisma-cli --chown=nextjs:nodejs /prisma/node_modules ./node_modules

USER nextjs
EXPOSE 3000
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node server.js"]
