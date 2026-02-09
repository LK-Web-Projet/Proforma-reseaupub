
async function main() {
    try {
        const res = await fetch("http://localhost:3000/api/fournisseurs/produits?fournisseurId=test-id");
        console.log("Status:", res.status);
        const text = await res.text();
        console.log("Body:", text);
    } catch (e) {
        console.error("Fetch error:", e);
    }
}
main();
