const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database started...");

  // 1. Clean database in reverse relation order
  await prisma.auditLog.deleteMany().catch(() => {});
  await prisma.leaveRequest.deleteMany().catch(() => {});
  await prisma.hrBotSession.deleteMany().catch(() => {});
  await prisma.hrPolicy.deleteMany().catch(() => {});
  await prisma.user.deleteMany().catch(() => {});

  // 2. Hash password
  const hashedPassword = await bcrypt.hash("password123", 10);

  // 3. Create Users
  const admin = await prisma.user.create({
    data: {
      email: "admin@nanovest.io",
      name: "Admin OpsHub",
      password: hashedPassword,
      role: "ADMIN",
    },
  });

  const hr = await prisma.user.create({
    data: {
      email: "hr@nanovest.io",
      name: "HR Specialist",
      password: hashedPassword,
      role: "HR",
    },
  });

  const user = await prisma.user.create({
    data: {
      email: "user@nanovest.io",
      name: "John Doe (Employee)",
      password: hashedPassword,
      role: "USER",
    },
  });

  console.log("Admin, HR, and Employee users created successfully.");

  // 4. Create Policies
  const policies = [
    {
      title: "Annual Leave Policy V1.0",
      content: "Employees are entitled to 12 days of annual leave per calendar year. Leaves must be requested at least 3 days in advance and approved by the team manager. Annual leave balances do not carry over to the next year.",
      category: "leave",
      metadata: { tags: ["leave", "holiday"], version: "1.0" },
    },
    {
      title: "Sick Leave Regulations",
      content: "Employees receive paid sick leave for illness or medical consultations. For absences exceeding 2 consecutive days, a valid medical certificate from a registered physician must be submitted via the OpsHub portal within 48 hours of return to work.",
      category: "leave",
      metadata: { tags: ["leave", "sick"], version: "1.1" },
    },
    {
      title: "Maternity & Paternity Leave Benefits",
      content: "Maternity leave is 3 months fully paid. It can be taken up to 1.5 months before the expected delivery date. Paternity leave is 5 consecutive days fully paid, to be taken within 1 month of child birth.",
      category: "leave",
      metadata: { tags: ["leave", "family"], version: "1.0" },
    },
    {
      title: "Payroll & Compensation Schedule",
      content: "Salaries are processed monthly and paid directly into bank accounts on the 25th of each month. If the 25th falls on a weekend or public holiday, salary will be paid on the preceding business day.",
      category: "payroll",
      metadata: { tags: ["payroll", "salary"], version: "1.2" },
    },
  ];

  // Insert policies
  for (const policy of policies) {
    // Generate deterministic mock embedding of size 1024
    const vector = new Array(1024).fill(0);
    let hash = 0;
    for (let i = 0; i < policy.content.length; i++) {
      hash = policy.content.charCodeAt(i) + ((hash << 5) - hash);
    }
    for (let j = 0; j < 1024; j++) {
      vector[j] = Math.sin(hash + j) * 0.1;
    }

    const id = `policy-${Math.random().toString(36).substring(2, 11)}`;
    const vectorString = `[${vector.join(",")}]`;
    const metadataString = JSON.stringify(policy.metadata);

    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "HrPolicy" (id, title, content, category, embedding, metadata, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5::vector, $6::json, NOW(), NOW())`,
        id,
        policy.title,
        policy.content,
        policy.category,
        vectorString,
        metadataString
      );
      console.log(`Seeded policy: ${policy.title} with pgvector embedding`);
    } catch (e) {
      // If pgvector is not enabled, insert without embedding
      await prisma.hrPolicy.create({
        data: {
          title: policy.title,
          content: policy.content,
          category: policy.category,
          metadata: policy.metadata,
        },
      });
      console.log(`Seeded policy: ${policy.title} (Standard DB Fallback)`);
    }
  }

  console.log("Database seeding completed successfully.");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
