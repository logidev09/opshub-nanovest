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
  await prisma.hrPolicy.deleteMany().catch(() => {});
  // await prisma.user.deleteMany().catch(() => {});

  const hashedPassword = await bcrypt.hash("password123", 10);

  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: "admin@nanovest.io" },
      update: { division: "CX Engineer", role: "ADMIN" },
      create: {
        email: "admin@nanovest.io",
        name: "Admin OpsHub",
        password: hashedPassword,
        role: "ADMIN",
        division: "CX Engineer",
      },
    }),
    prisma.user.upsert({
      where: { email: "hr@nanovest.io" },
      update: { division: "HR", role: "HR" },
      create: {
        email: "hr@nanovest.io",
        name: "HR Specialist",
        password: hashedPassword,
        role: "HR",
        division: "HR",
      },
    }),
    prisma.user.upsert({
      where: { email: "accountant@nanovest.io" },
      update: { division: "Accounting", role: "USER" },
      create: {
        email: "accountant@nanovest.io",
        name: "Accountant Demo",
        password: hashedPassword,
        role: "USER",
        division: "Accounting",
      },
    }),
    prisma.user.upsert({
      where: { email: "qa@nanovest.io" },
      update: { division: "Quality Assurance", role: "USER" },
      create: {
        email: "qa@nanovest.io",
        name: "QA Tester Demo",
        password: hashedPassword,
        role: "USER",
        division: "Quality Assurance",
      },
    }),
    prisma.user.upsert({
      where: { email: "secops@nanovest.io" },
      update: { division: "Security Operations & IT Support", role: "USER" },
      create: {
        email: "secops@nanovest.io",
        name: "SecOps Engineer Demo",
        password: hashedPassword,
        role: "USER",
        division: "Security Operations & IT Support",
      },
    }),
  ]);

  const [admin, hr, accountant, qa, secops] = users;
  const employee = accountant;
  const sarah = qa;
  const budi = secops;
  console.log("Seeded/Loaded demo users (Admin, HR, Accountant, QA, SecOps).");

  await seedPolicies([
    {
      title: "Kebijakan Cuti Tahunan RI Juli 2026 (UU Ketenagakerjaan)",
      content:
        "Berdasarkan Peraturan Ketenagakerjaan RI Terbaru Juli 2026, setiap karyawan berhak atas cuti tahunan sekurang-kurangnya 12 (dua belas) hari kerja setelah karyawan yang bersangkutan bekerja selama 12 (dua belas) bulan secara terus menerus. Pengajuan cuti harus diajukan melalui sistem OpsHub Nanovest paling lambat 3 hari sebelum pelaksanaan cuti, dan harus disetujui oleh HR atau Admin sebelum tanggal pelaksanaan cuti tersebut. Saldo cuti tahunan hangus jika tidak digunakan dalam kurun waktu 18 bulan sejak hak cuti timbul.",
      category: "leave",
      metadata: { tags: ["leave", "annual", "indonesia-law"], version: "2.1" },
    },
    {
      title: "Kebijakan Cuti Sakit & Surat Dokter RI Juli 2026",
      content:
        "Karyawan yang sakit berhak mendapatkan cuti sakit berbayar penuh. Apabila cuti sakit melebihi 2 (dua) hari kerja berturut-turut, karyawan wajib menyertakan Surat Keterangan Dokter (SKD) atau resep dokter yang sah dan mengunggahnya ke dalam sistem OpsHub maksimal 48 jam sejak hari pertama masuk kerja kembali. Upah tetap dibayar 100% untuk sakit selama 4 bulan pertama, 75% untuk 4 bulan kedua, 50% untuk 4 bulan ketiga, dan 25% untuk bulan berikutnya sebelum dilakukan PHK medis.",
      category: "leave",
      metadata: { tags: ["leave", "sick", "doctor-note"], version: "1.3" },
    },
    {
      title: "Kebijakan Cuti Hamil, Melahirkan, & Cuti Ayah Juli 2026 (UU KIA)",
      content:
        "Sesuai UU KIA Ketenagakerjaan Juli 2026, karyawan perempuan berhak memperoleh cuti melahirkan selama 3 (tiga) bulan penuh berbayar upah 100%, yang dapat diperpanjang hingga paling lama 6 (enam) bulan jika terdapat kondisi medis khusus yang dibuktikan dengan surat dokter. Upah untuk bulan ke-4 dibayar 100% dan bulan ke-5 serta ke-6 dibayar 75%. Karyawan laki-laki (suami) berhak atas cuti pendampingan istri melahirkan (cuti ayah) selama 2 (dua) hari kerja berbayar penuh, dan dapat ditambah hingga 3 (tiga) hari kerja berikutnya sesuai kesepakatan.",
      category: "leave",
      metadata: { tags: ["leave", "family", "maternity", "paternity"], version: "1.2" },
    },
    {
      title: "Skema Upah Lembur & Payroll Juli 2026",
      content:
        "Penggajian di Nanovest diproses secara terpusat setiap bulan pada tanggal 25. Perhitungan lembur mengikuti ketentuan Ketenagakerjaan Juli 2026: jam lembur pertama dibayar 1.5x upah per jam, dan jam lembur berikutnya dibayar 2x upah per jam. Pada hari libur resmi, lembur dibayar 2x upah per jam untuk 8 jam pertama, 3x upah per jam untuk jam ke-9, dan 4x upah per jam untuk jam ke-10 dan seterusnya. Seluruh klaim lembur wajib divalidasi oleh atasan langsung dan diposting sebelum tanggal 20.",
      category: "payroll",
      metadata: { tags: ["payroll", "reimbursement", "overtime"], version: "1.5" },
    },
    {
      title: "Ketentuan Jam Kerja & Kehadiran Juli 2026",
      content:
        "Jam kerja standar di Nanovest diatur 40 jam dalam 1 minggu (8 jam per hari untuk 5 hari kerja). Karyawan yang melakukan kerja jarak jauh (WFA) diwajibkan untuk mencatatkan kehadirannya secara digital menggunakan verifikasi lokasi (geofencing). Pelanggaran kehadiran tanpa izin tertulis akan dikenakan sanksi bertahap mulai dari SP-1 (berlaku 6 bulan), SP-2 (berlaku 6 bulan), hingga SP-3 (PHK) sesuai regulasi terbaru.",
      category: "regulation",
      metadata: { tags: ["attendance", "remote", "warning-letter"], version: "1.1" },
    },
    {
      title: "Pedoman PSAK 72 / IFRS 15 - Pengakuan Pendapatan Juli 2026",
      content:
        "Berdasarkan standar PSAK 72 dan IFRS 15 terbaru per Juli 2026, pendapatan dari kontrak dengan pelanggan diakui dengan 5 langkah evaluasi: mengidentifikasi kontrak, mengidentifikasi kewajiban kinerja, menentukan harga transaksi, mengalokasikan harga transaksi, dan mengakui pendapatan saat kewajiban kinerja terpenuhi. Segala bentuk rabat, insentif, dan retur harus dicatat sebagai pengurang pendapatan usaha secara akurat di akhir periode buku.",
      category: "finance_psak",
      metadata: { tags: ["psak", "revenue", "accounting"], version: "1.1" },
    },
    {
      title: "Pedoman Penyajian Laporan Keuangan IFRS 18 Juli 2026",
      content:
        "Penyajian laporan keuangan per Juli 2026 wajib mengadopsi standar IFRS 18 yang memisahkan laba rugi menjadi tiga kategori utama: Pendapatan Operasi, Investasi, dan Pembiayaan. Hal ini bertujuan untuk memberikan transparansi kesehatan finansial korporasi serta mempermudah analisis margin operasional oleh auditor eksternal. Penyesuaian terhadap aset neto wajib dicatat secara berkala.",
      category: "finance_ifrs",
      metadata: { tags: ["ifrs", "presentation", "financial-statements"], version: "1.1" },
    },
    {
      title: "Ketentuan Pajak PPN 12% & PPh Badan Juli 2026",
      content:
        "Ketentuan perpajakan Republik Indonesia per Juli 2026 menetapkan tarif PPN standar sebesar 12% (penyesuaian dari tarif sebelumnya 11%). Untuk PPh Badan ditetapkan tarif tetap 22% dari penghasilan kena pajak. Pajak tangguhan (deferred tax) atas perbedaan temporer wajib diukur menggunakan tarif ini. Pemotongan PPh Pasal 21 atas upah karyawan menggunakan metode TER (Tarif Efektif Rata-rata) PP 58/2023, dan PPh Pasal 23 atas jasa vendor sebesar 2% wajib dicatat dan dilaporkan melalui e-Bupot paling lambat tanggal 10 bulan berikutnya.",
      category: "finance_tax",
      metadata: { tags: ["tax", "ppn-12", "pph", "pp58"], version: "1.1" },
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
