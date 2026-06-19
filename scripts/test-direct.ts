
import { PrismaClient } from "@prisma/client";
import dotenv from 'dotenv';
dotenv.config();

const directUrl = process.env.DIRECT_URL;
console.log("Testing DIRECT_URL:", directUrl?.replace(/:[^@:]*@/, ':****@'));

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: directUrl,
        },
    },
});

async function main() {
    try {
        const result = await prisma.$queryRaw`SELECT 1`;
        console.log("Connection successful:", result);
    } catch (error) {
        console.error("Connection failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
