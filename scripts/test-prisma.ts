
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
    log: ["query"],
});

async function main() {
    console.log("Testing Prisma connection...");
    try {
        // Try creating a dummy product if none exists to ensure we test the Decimal case
        // First check if we have any
        let products = await prisma.produitFournisseur.findMany({ take: 1 });

        if (products.length === 0) {
            console.log("No products found, creating a test supplier and product...");
            // Create a dummy supplier first if needed, but let's check one
            const supplier = await prisma.fournisseur.findFirst();
            let supplierId = supplier?.id;

            if (!supplierId) {
                const newSupplier = await prisma.fournisseur.create({
                    data: {
                        entreprise: "Test Supplier " + Date.now(),
                        contact: "Test Contact",
                        domaineActivite: "Test Domain",
                        adresse: "Test Address",
                        email: "test" + Date.now() + "@example.com",
                    }
                });
                supplierId = newSupplier.id;
            }

            await prisma.produitFournisseur.create({
                data: {
                    designation: "Test Product",
                    prixUnitaire: 100.50,
                    typeUnite: "UNITE",
                    fournisseurId: supplierId
                }
            });
            products = await prisma.produitFournisseur.findMany({ take: 1 });
        }

        console.log("Fetched products:", products);

        try {
            const json = JSON.stringify(products);
            console.log("JSON serialization successful:", json);
        } catch (e) {
            console.error("JSON serialization failed:", e);
        }

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
