import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["query"],
    // Base distante (Supabase) : chaque requête peut prendre ~1 s. Les 5 s par défaut d'une
    // transaction interactive ne suffisaient pas (erreur P2028 « Transaction not found » sur
    // « Tout valider »). Une transaction peut attendre 10 s une connexion et durer 30 s.
    transactionOptions: { maxWait: 10_000, timeout: 30_000 },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
