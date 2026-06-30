const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Connecting to database and enabling pgvector extension...");
  // Enable pgvector extension
  await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS vector;");
  console.log("pgvector extension has been enabled successfully in the database!");
}

main()
  .catch((e) => {
    console.error("Error enabling pgvector:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
