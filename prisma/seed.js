/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

function buildMockEmbedding(text) {
  const vector = new Array(1024).fill(0);
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  for (let j = 0; j < 1024; j++) {
    vector[j] = Math.sin(hash + j) * 0.1;
  }
  return vector;
}

async function seedPolicies(policies) {
  for (const policy of policies) {
    const vectorString = `[${buildMockEmbedding(policy.content).join(",")}]`;
    const metadataString = JSON.stringify(policy.metadata);

    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "HrPolicy" (id, title, content, category, embedding, metadata, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5::vector, $6::json, NOW(), NOW())`,
        `policy-${Math.random().toString(36).substring(2, 11)}`,
        policy.title,
        policy.content,
        policy.category,
        vectorString,
        metadataString
      );
      console.log(`Seeded policy with pgvector: ${policy.title}`);
    } catch {
      await prisma.hrPolicy.create({
        data: {
          title: policy.title,
          content: policy.content,
          category: policy.category,
          metadata: policy.metadata,
        },
      });
      console.log(`Seeded policy without pgvector: ${policy.title}`);
    }
  }
}

async function createJournalEntry({ reference, description, entryDate, postedById, lines }, accountMap) {
  const totalDebit = lines
    .filter((line) => line.side === "DEBIT")
    .reduce((sum, line) => sum + line.amount, 0);
  const totalCredit = lines
    .filter((line) => line.side === "CREDIT")
    .reduce((sum, line) => sum + line.amount, 0);

  if (totalDebit !== totalCredit) {
    throw new Error(`Journal entry ${reference} is unbalanced.`);
  }

  return prisma.journalEntry.create({
    data: {
      reference,
      description,
      entryDate,
      postedById,
      totalDebit,
      totalCredit,
      lines: {
        create: lines.map((line) => ({
          financeAccountId: accountMap.get(line.code),
          side: line.side,
          amount: line.amount,
        })),
      },
    },
  });
}

async function main() {
  console.log("Seeding database started...");

  await prisma.journalLine.deleteMany().catch(() => {});
  await prisma.journalEntry.deleteMany().catch(() => {});
  await prisma.financeAccount.deleteMany().catch(() => {});
  // await prisma.systemFeedback.deleteMany().catch(() => {});
  // await prisma.auditLog.deleteMany().catch(() => {});
  // await prisma.leaveRequest.deleteMany().catch(() => {});
  // await prisma.hrBotSession.deleteMany().catch(() => {});
  // await prisma.hrPolicy.deleteMany().catch(() => {});
  // await prisma.user.deleteMany().catch(() => {});

  const hashedPassword = await bcrypt.hash("password123", 10);

  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: "admin@nanovest.io" },
      update: {},
      create: {
        email: "admin@nanovest.io",
        name: "Admin OpsHub",
        password: hashedPassword,
        role: "ADMIN",
      },
    }),
    prisma.user.upsert({
      where: { email: "hr@nanovest.io" },
      update: {},
      create: {
        email: "hr@nanovest.io",
        name: "HR Specialist",
        password: hashedPassword,
        role: "HR",
      },
    }),
    prisma.user.upsert({
      where: { email: "user@nanovest.io" },
      update: {},
      create: {
        email: "user@nanovest.io",
        name: "John Doe",
        password: hashedPassword,
        role: "USER",
      },
    }),
    prisma.user.upsert({
      where: { email: "sarah@nanovest.io" },
      update: {},
      create: {
        email: "sarah@nanovest.io",
        name: "Sarah Wijaya",
        password: hashedPassword,
        role: "USER",
      },
    }),
    prisma.user.upsert({
      where: { email: "budi@nanovest.io" },
      update: {},
      create: {
        email: "budi@nanovest.io",
        name: "Budi Santoso",
        password: hashedPassword,
        role: "USER",
      },
    }),
  ]);

  const [admin, hr, employee, sarah, budi] = users;
  console.log("Seeded/Loaded demo users.");

  await seedPolicies([
    {
      title: "Annual Leave Policy V2.0",
      content:
        "Employees are entitled to 12 working days of annual leave per calendar year. Annual leave requests should be submitted through OpsHub and approved by HR or the direct manager before the leave start date whenever possible.",
      category: "leave",
      metadata: { tags: ["leave", "annual"], version: "2.0" },
    },
    {
      title: "Medical and Sick Leave Policy",
      content:
        "Employees may request paid sick leave for illness, recovery, medical checkups, or prescribed rest. A doctor's note is recommended for absences longer than 2 consecutive days and must be uploaded within 48 hours after returning to work.",
      category: "leave",
      metadata: { tags: ["leave", "sick"], version: "1.2" },
    },
    {
      title: "Maternity, Paternity, and Family Leave",
      content:
        "Maternity leave is granted for 3 months with statutory compensation. Paternity leave is granted for 5 working days. Additional unpaid family leave may be discussed with HR for urgent family matters.",
      category: "leave",
      metadata: { tags: ["leave", "family"], version: "1.1" },
    },
    {
      title: "Payroll and Reimbursement Schedule",
      content:
        "Monthly salaries are paid every 25th through the registered bank account. Approved reimbursement claims are paid together with payroll or within the next weekly payment cycle depending on the claim type.",
      category: "payroll",
      metadata: { tags: ["payroll", "reimbursement"], version: "1.4" },
    },
    {
      title: "Remote Work and Attendance Guidelines",
      content:
        "Employees who work remotely must maintain attendance logs and remain reachable during agreed working hours. Leave requests and attendance corrections must be recorded through OpsHub to preserve an audit trail.",
      category: "regulation",
      metadata: { tags: ["attendance", "remote"], version: "1.0" },
    },
  ]);

  await prisma.leaveRequest.createMany({
    data: [
      {
        userId: employee.id,
        type: "ANNUAL",
        startDate: new Date("2026-06-10"),
        endDate: new Date("2026-06-12"),
        reason: "Family vacation in Yogyakarta",
        status: "APPROVED",
        approvedBy: hr.id,
        approvedAt: new Date("2026-06-08T09:00:00Z"),
      },
      {
        userId: employee.id,
        type: "SICK",
        startDate: new Date("2026-07-02"),
        endDate: new Date("2026-07-03"),
        reason: "Dental checkup and recovery",
        status: "PENDING",
      },
      {
        userId: sarah.id,
        type: "ANNUAL",
        startDate: new Date("2026-07-15"),
        endDate: new Date("2026-07-18"),
        reason: "Family event outside town",
        status: "PENDING",
      },
      {
        userId: budi.id,
        type: "UNPAID",
        startDate: new Date("2026-06-24"),
        endDate: new Date("2026-06-24"),
        reason: "Personal administration day",
        status: "REJECTED",
        approvedBy: hr.id,
        approvedAt: new Date("2026-06-23T06:30:00Z"),
      },
      {
        userId: budi.id,
        type: "ANNUAL",
        startDate: new Date("2026-08-05"),
        endDate: new Date("2026-08-07"),
        reason: "Wedding preparation leave",
        status: "PENDING",
      },
    ],
  });
  console.log("Seeded leave requests.");

  const chartOfAccounts = [
    ["1101", "Kas Kecil", "ASSET", "DEBIT"],
    ["1102", "Bank BCA", "ASSET", "DEBIT"],
    ["1103", "Bank Mandiri", "ASSET", "DEBIT"],
    ["1104", "Piutang Usaha", "ASSET", "DEBIT"],
    ["1105", "Cadangan Kerugian Piutang", "ASSET", "CREDIT"],
    ["1106", "Persediaan", "ASSET", "DEBIT"],
    ["1107", "Pajak Dibayar Dimuka", "ASSET", "DEBIT"],
    ["1108", "Biaya Dibayar Dimuka Sewa", "ASSET", "DEBIT"],
    ["1109", "Uang Muka Karyawan", "ASSET", "DEBIT"],
    ["1201", "Peralatan Kantor", "ASSET", "DEBIT"],
    ["1202", "Akumulasi Penyusutan Peralatan Kantor", "ASSET", "CREDIT"],
    ["1203", "Kendaraan Operasional", "ASSET", "DEBIT"],
    ["1204", "Akumulasi Penyusutan Kendaraan", "ASSET", "CREDIT"],
    ["1205", "Perangkat Lunak", "ASSET", "DEBIT"],
    ["1206", "Akumulasi Amortisasi Perangkat Lunak", "ASSET", "CREDIT"],
    ["2101", "Utang Usaha", "LIABILITY", "CREDIT"],
    ["2102", "Utang Gaji", "LIABILITY", "CREDIT"],
    ["2103", "Utang Pajak", "LIABILITY", "CREDIT"],
    ["2104", "Biaya Masih Harus Dibayar", "LIABILITY", "CREDIT"],
    ["2105", "Pendapatan Diterima Dimuka", "LIABILITY", "CREDIT"],
    ["2201", "Liabilitas Sewa", "LIABILITY", "CREDIT"],
    ["2202", "Pinjaman Bank Jangka Panjang", "LIABILITY", "CREDIT"],
    ["3101", "Modal Disetor", "EQUITY", "CREDIT"],
    ["3102", "Tambahan Modal Disetor", "EQUITY", "CREDIT"],
    ["3103", "Saldo Laba Ditahan", "EQUITY", "CREDIT"],
    ["4101", "Pendapatan Jasa Konsultasi", "REVENUE", "CREDIT"],
    ["4102", "Pendapatan Berlangganan SaaS", "REVENUE", "CREDIT"],
    ["4103", "Pendapatan Lain-lain", "REVENUE", "CREDIT"],
    ["5101", "Beban Gaji", "EXPENSE", "DEBIT"],
    ["5102", "Beban Sewa", "EXPENSE", "DEBIT"],
    ["5103", "Beban Internet dan Utilitas", "EXPENSE", "DEBIT"],
    ["5104", "Beban Penyusutan Peralatan", "EXPENSE", "DEBIT"],
    ["5105", "Beban Perjalanan Dinas", "EXPENSE", "DEBIT"],
    ["5106", "Beban Perawatan Sistem", "EXPENSE", "DEBIT"],
    ["5107", "Beban Pajak", "EXPENSE", "DEBIT"],
    ["5108", "Beban Pelatihan Karyawan", "EXPENSE", "DEBIT"],
  ];

  await prisma.financeAccount.createMany({
    data: chartOfAccounts.map(([code, name, category, normalBalance]) => ({
      code,
      name,
      category,
      normalBalance,
      isSystem: true,
    })),
  });

  const financeAccounts = await prisma.financeAccount.findMany();
  const accountMap = new Map(financeAccounts.map((account) => [account.code, account.id]));

  const entries = [
    {
      reference: "JE-2026-0001",
      description: "Setoran modal awal pendiri",
      entryDate: new Date("2026-01-02"),
      postedById: admin.id,
      lines: [
        { code: "1102", side: "DEBIT", amount: 500000000 },
        { code: "3101", side: "CREDIT", amount: 500000000 },
      ],
    },
    {
      reference: "JE-2026-0002",
      description: "Pengisian kas kecil dari bank",
      entryDate: new Date("2026-01-03"),
      postedById: admin.id,
      lines: [
        { code: "1101", side: "DEBIT", amount: 25000000 },
        { code: "1102", side: "CREDIT", amount: 25000000 },
      ],
    },
    {
      reference: "JE-2026-0003",
      description: "Pembayaran sewa kantor 6 bulan dimuka",
      entryDate: new Date("2026-01-05"),
      postedById: admin.id,
      lines: [
        { code: "1108", side: "DEBIT", amount: 60000000 },
        { code: "1102", side: "CREDIT", amount: 60000000 },
      ],
    },
    {
      reference: "JE-2026-0004",
      description: "Pembelian peralatan kantor secara kredit",
      entryDate: new Date("2026-01-10"),
      postedById: admin.id,
      lines: [
        { code: "1201", side: "DEBIT", amount: 85000000 },
        { code: "2101", side: "CREDIT", amount: 85000000 },
      ],
    },
    {
      reference: "JE-2026-0005",
      description: "Pengakuan pendapatan jasa konsultasi",
      entryDate: new Date("2026-02-01"),
      postedById: hr.id,
      lines: [
        { code: "1104", side: "DEBIT", amount: 150000000 },
        { code: "4101", side: "CREDIT", amount: 150000000 },
      ],
    },
    {
      reference: "JE-2026-0006",
      description: "Penerimaan pembayaran pelanggan",
      entryDate: new Date("2026-02-14"),
      postedById: admin.id,
      lines: [
        { code: "1102", side: "DEBIT", amount: 120000000 },
        { code: "1104", side: "CREDIT", amount: 120000000 },
      ],
    },
    {
      reference: "JE-2026-0007",
      description: "Pembayaran gaji bulan Februari",
      entryDate: new Date("2026-02-25"),
      postedById: hr.id,
      lines: [
        { code: "5101", side: "DEBIT", amount: 45000000 },
        { code: "1102", side: "CREDIT", amount: 45000000 },
      ],
    },
    {
      reference: "JE-2026-0008",
      description: "Akrual beban utilitas dan internet",
      entryDate: new Date("2026-02-28"),
      postedById: admin.id,
      lines: [
        { code: "5103", side: "DEBIT", amount: 7500000 },
        { code: "2104", side: "CREDIT", amount: 7500000 },
      ],
    },
    {
      reference: "JE-2026-0009",
      description: "Pendapatan berlangganan diterima dimuka",
      entryDate: new Date("2026-03-05"),
      postedById: admin.id,
      lines: [
        { code: "1102", side: "DEBIT", amount: 90000000 },
        { code: "2105", side: "CREDIT", amount: 90000000 },
      ],
    },
    {
      reference: "JE-2026-0010",
      description: "Penerimaan pembayaran pelanggan",
      entryDate: new Date("2026-04-12"),
      postedById: admin.id,
      lines: [
        { code: "1102", side: "DEBIT", amount: 135000000 },
        { code: "1104", side: "CREDIT", amount: 135000000 },
      ],
    },
    {
      reference: "JE-2026-0011",
      description: "Pembayaran gaji bulan April",
      entryDate: new Date("2026-04-25"),
      postedById: hr.id,
      lines: [
        { code: "5101", side: "DEBIT", amount: 48000000 },
        { code: "1102", side: "CREDIT", amount: 48000000 },
      ],
    },
    {
      reference: "JE-2026-0012",
      description: "Pengakuan pendapatan jasa konsultasi",
      entryDate: new Date("2026-05-15"),
      postedById: hr.id,
      lines: [
        { code: "1104", side: "DEBIT", amount: 180000000 },
        { code: "4101", side: "CREDIT", amount: 180000000 },
      ],
    },
    {
      reference: "JE-2026-0013",
      description: "Pembayaran gaji bulan Mei",
      entryDate: new Date("2026-05-25"),
      postedById: hr.id,
      lines: [
        { code: "5101", side: "DEBIT", amount: 48000000 },
        { code: "1102", side: "CREDIT", amount: 48000000 },
      ],
    },
    {
      reference: "JE-2026-0014",
      description: "Pendapatan berlangganan bulanan",
      entryDate: new Date("2026-06-10"),
      postedById: admin.id,
      lines: [
        { code: "1102", side: "DEBIT", amount: 110000000 },
        { code: "4102", side: "CREDIT", amount: 110000000 },
      ],
    },
    {
      reference: "JE-2026-0015",
      description: "Pembayaran gaji bulan Juni",
      entryDate: new Date("2026-06-25"),
      postedById: hr.id,
      lines: [
        { code: "5101", side: "DEBIT", amount: 48000000 },
        { code: "1102", side: "CREDIT", amount: 48000000 },
      ],
    },
    {
      reference: "JE-2026-0016",
      description: "Penerimaan pembayaran pelanggan",
      entryDate: new Date("2026-07-05"),
      postedById: admin.id,
      lines: [
        { code: "1102", side: "DEBIT", amount: 145000000 },
        { code: "1104", side: "CREDIT", amount: 145000000 },
      ],
    },
  ];

  for (const entry of entries) {
    await createJournalEntry(entry, accountMap);
  }
  console.log("Seeded finance ledger.");

  await prisma.systemFeedback.createMany({
    data: [
      {
        module: "QA",
        category: "UI_UX",
        message: "Tanggal picker di pengajuan cuti perlu tombol kalender agar lebih jelas di browser desktop.",
        status: "OPEN",
        submittedById: employee.id,
        assignedToId: admin.id,
      },
      {
        module: "SECOPS",
        category: "CONNECTION",
        message: "Tambahkan health check koneksi API dan database agar admin tahu jika backend tidak responsif.",
        status: "IN_REVIEW",
        submittedById: sarah.id,
        assignedToId: admin.id,
      },
      {
        module: "QA",
        category: "TEST_CASE",
        message: "Perlu test otomatis untuk login invalid, auto-submit leave via AI, dan approval leave oleh HR.",
        status: "OPEN",
        submittedById: admin.id,
        assignedToId: hr.id,
      },
    ],
  });

  await prisma.auditLog.createMany({
    data: [
      {
        userId: admin.id,
        action: "SEED_FINANCE_LEDGER",
        entity: "JournalEntry",
        entityId: "bootstrap",
        newValue: { totalEntries: entries.length },
      },
      {
        userId: hr.id,
        action: "SEED_LEAVE_REQUESTS",
        entity: "LeaveRequest",
        entityId: "bootstrap",
        newValue: { totalRequests: 5 },
      },
      {
        userId: admin.id,
        action: "SEED_FEEDBACK_INBOX",
        entity: "SystemFeedback",
        entityId: "bootstrap",
        newValue: { totalFeedback: 3 },
      },
    ],
  });

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
