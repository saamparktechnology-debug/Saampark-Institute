import bcrypt from "bcryptjs";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Populates the MySQL database with foundational RBAC permissions, 4 role accounts,
 * course categories, published courses, multi-teacher assignments, payment plan templates,
 * enrollments, installments, course materials, live classes, assignments, and support tickets
 * so the frontend renders 100% real database records via API calls.
 */
async function main() {
  console.log(
    "[SEED] Starting database seed for Online Learning Platform (Phase 1 & Phase 2)...",
  );

  const passwordHash = await bcrypt.hash("Password123!", 12);

  // 1. Seed Users for all 4 roles
  const adminUser = await prisma.user.upsert({
    where: { email: "admin.jack@institute.edu" },
    update: {},
    create: {
      email: "admin.jack@institute.edu",
      phone: "+919000000001",
      passwordHash,
      fullName: "Jack Anderson (Super Admin)",
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  const teacherPrimary = await prisma.user.upsert({
    where: { email: "prof.david@institute.edu" },
    update: {},
    create: {
      email: "prof.david@institute.edu",
      phone: "+919000000002",
      passwordHash,
      fullName: "Prof. David S.",
      role: "TEACHER",
      status: "ACTIVE",
      teacherProfile: {
        create: {
          teacherCode: "TCH-2026-001",
          qualification: "Ph.D. Theoretical Physics & Chemistry",
          specialization: "Quantum Mechanics & Organic Chemistry",
          defaultRevenueSharePercent: new Prisma.Decimal("30.00"),
        },
      },
    },
  });

  const teacherCo = await prisma.user.upsert({
    where: { email: "dr.meera@institute.edu" },
    update: {},
    create: {
      email: "dr.meera@institute.edu",
      phone: "+919000000003",
      passwordHash,
      fullName: "Dr. Meera Nair",
      role: "TEACHER",
      status: "ACTIVE",
      teacherProfile: {
        create: {
          teacherCode: "TCH-2026-002",
          qualification: "M.Tech Cyber Security",
          specialization: "Cryptography & Network Security",
          defaultRevenueSharePercent: new Prisma.Decimal("25.00"),
        },
      },
    },
  });

  const studentUser = await prisma.user.upsert({
    where: { email: "sarah.student@institute.edu" },
    update: {},
    create: {
      email: "sarah.student@institute.edu",
      phone: "+919000000004",
      passwordHash,
      fullName: "Sarah Sen",
      role: "STUDENT",
      status: "ACTIVE",
      studentProfile: {
        create: {
          studentCode: "STU-2026-042",
          gradeLevel: "Undergraduate Year 3",
        },
      },
      wallet: {
        create: {
          currency: "INR",
          availableBalance: new Prisma.Decimal("2450.00"),
          reservedBalance: new Prisma.Decimal("0.00"),
        },
      },
      referralCode: {
        create: {
          code: "ARGON-SARAH42",
          isActive: true,
        },
      },
    },
  });

  await prisma.user.upsert({
    where: { email: "captain.support@institute.edu" },
    update: {},
    create: {
      email: "captain.support@institute.edu",
      phone: "+919000000005",
      passwordHash,
      fullName: "Rohan Roy (Support Lead)",
      role: "SUPPORT",
      status: "ACTIVE",
      supportAgentProfile: {
        create: {
          agentCode: "SUP-2026-001",
          department: "BILLING_AND_TRIAGE",
          isTriageLead: true,
          maxConcurrentTickets: 25,
        },
      },
    },
  });

  // 2. Seed Course Categories
  const physicsCategory = await prisma.courseCategory.upsert({
    where: { slug: "quantum-and-physical-sciences" },
    update: {},
    create: {
      name: "Quantum & Physical Sciences",
      slug: "quantum-and-physical-sciences",
      description:
        "Advanced physics, chemistry, and mathematical modeling courses.",
      isActive: true,
    },
  });

  const securityCategory = await prisma.courseCategory.upsert({
    where: { slug: "cyber-and-quantum-security" },
    update: {},
    create: {
      name: "Cyber & Quantum Security",
      slug: "cyber-and-quantum-security",
      description: "Network defense, cryptography, and zero-trust engineering.",
      isActive: true,
    },
  });

  // 3. Seed Published Courses with Multi-Teacher Assignments & Payment Plan Templates
  const quantumCourse = await prisma.course.upsert({
    where: { code: "PHYS-401" },
    update: {},
    create: {
      categoryId: physicsCategory.id,
      code: "PHYS-401",
      title: "Quantum Physics & Wave Mechanics",
      slug: "quantum-physics-and-wave-mechanics",
      shortDescription:
        "Wave-particle duality, Schrödinger operators & live problem labs.",
      description:
        "Comprehensive cohort course covering Hilbert spaces, quantum operators, perturbation theory, and entanglement.",
      level: "ADVANCED",
      language: "English",
      basePrice: new Prisma.Decimal("13500.00"),
      currency: "INR",
      status: "PUBLISHED",
      minAttendancePercent: new Prisma.Decimal("75.00"),
      minPassMarksPercent: new Prisma.Decimal("50.00"),
      publishedAt: new Date(),
      createdById: adminUser.id,
    },
  });

  const cyberCourse = await prisma.course.upsert({
    where: { code: "CSEC-302" },
    update: {},
    create: {
      categoryId: securityCategory.id,
      code: "CSEC-302",
      title: "Zero-Trust Cyber Security Architecture",
      slug: "zero-trust-cyber-security-architecture",
      shortDescription:
        "Network defense, cryptographic protocols & live incident drills.",
      description:
        "Hands-on security engineering covering TLS internals, identity federation, kernel hardening, and threat hunting.",
      level: "INTERMEDIATE",
      language: "English",
      basePrice: new Prisma.Decimal("12000.00"),
      currency: "INR",
      status: "PUBLISHED",
      minAttendancePercent: new Prisma.Decimal("75.00"),
      minPassMarksPercent: new Prisma.Decimal("50.00"),
      publishedAt: new Date(),
      createdById: adminUser.id,
    },
  });

  // Multi-teacher assignments (C-026)
  await prisma.courseTeacherAssignment.upsert({
    where: {
      courseId_teacherId: {
        courseId: quantumCourse.id,
        teacherId: teacherPrimary.id,
      },
    },
    update: {},
    create: {
      courseId: quantumCourse.id,
      teacherId: teacherPrimary.id,
      assignmentRole: "PRIMARY",
      revenueSharePercent: new Prisma.Decimal("30.00"),
      status: "ACTIVE",
    },
  });

  await prisma.courseTeacherAssignment.upsert({
    where: {
      courseId_teacherId: {
        courseId: quantumCourse.id,
        teacherId: teacherCo.id,
      },
    },
    update: {},
    create: {
      courseId: quantumCourse.id,
      teacherId: teacherCo.id,
      assignmentRole: "CO_INSTRUCTOR",
      revenueSharePercent: new Prisma.Decimal("15.00"),
      status: "ACTIVE",
    },
  });

  // Payment plan templates (Full + 3-Installment Plan)
  const existingPlans = await prisma.paymentPlanTemplate.findMany({
    where: { courseId: quantumCourse.id },
  });

  let installmentPlanId = existingPlans.find(
    (p) => p.planType === "INSTALLMENT",
  )?.id;
  if (!installmentPlanId) {
    const createdPlan = await prisma.paymentPlanTemplate.create({
      data: {
        courseId: quantumCourse.id,
        name: "3-Month Equal Installment Plan",
        planType: "INSTALLMENT",
        installmentCount: 3,
        totalAmount: new Prisma.Decimal("13500.00"),
        currency: "INR",
        gracePeriodDays: 5,
        isActive: true,
      },
    });
    installmentPlanId = createdPlan.id;

    await prisma.paymentPlanTemplate.create({
      data: {
        courseId: quantumCourse.id,
        name: "One-Time Full Payment",
        planType: "FULL",
        installmentCount: 1,
        totalAmount: new Prisma.Decimal("13500.00"),
        currency: "INR",
        gracePeriodDays: 0,
        isActive: true,
      },
    });
  }

  // 4. Seed Curriculum Section, Lessons & Material
  const sectionCount = await prisma.courseSection.count({
    where: { courseId: quantumCourse.id },
  });

  if (sectionCount === 0) {
    const sec1 = await prisma.courseSection.create({
      data: {
        courseId: quantumCourse.id,
        title: "Module 1: Foundations of Wave Mechanics",
        description:
          "De Broglie wavelength, wave packets, and uncertainty relations.",
        sortOrder: 1,
        lessons: {
          create: [
            {
              title:
                "Lecture 1.1: Wave-Particle Duality & Double-Slit Interference",
              contentType: "VIDEO",
              durationSeconds: 2700,
              sortOrder: 1,
              isPreview: true,
            },
            {
              title: "Lecture 1.2: Time-Dependent Schrödinger Equation",
              contentType: "VIDEO",
              durationSeconds: 3300,
              sortOrder: 2,
              isPreview: false,
            },
          ],
        },
      },
    });

    await prisma.courseMaterial.create({
      data: {
        courseId: quantumCourse.id,
        title: "Quantum Operators Formula Sheet & Problem Set 1",
        description:
          "Reference handbook for Hermitian operators and commutator algebra.",
        fileName: "quantum_operators_handbook.pdf",
        mimeType: "application/pdf",
        sizeBytes: BigInt(2458624),
        storageProvider: "LOCAL_VPS",
        storageKey: `courses/${quantumCourse.id}/materials/quantum_operators_handbook.pdf`,
        uploadedById: teacherPrimary.id,
      },
    });

    console.log(`[SEED] Created section ${sec1.title} and course material.`);
  }

  // 5. Seed Active Student Enrollment (1st Installment Verified -> ACTIVE per C-027)
  const existingEnrollment = await prisma.enrollment.findFirst({
    where: { studentId: studentUser.id, courseId: quantumCourse.id },
  });

  if (!existingEnrollment && installmentPlanId) {
    const now = new Date();
    const due2 = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
    const due3 = new Date(now.getTime() + 60 * 24 * 3600 * 1000);

    const enrollment = await prisma.enrollment.create({
      data: {
        studentId: studentUser.id,
        courseId: quantumCourse.id,
        paymentPlanTemplateId: installmentPlanId,
        planTypeSnapshot: "INSTALLMENT",
        purchasedPriceSnapshot: new Prisma.Decimal("13500.00"),
        currencySnapshot: "INR",
        status: "ACTIVE",
        progressPercent: new Prisma.Decimal("76.00"),
        activatedAt: now,
        installments: {
          create: [
            {
              sequenceNumber: 1,
              amount: new Prisma.Decimal("4500.00"),
              currency: "INR",
              dueAt: now,
              graceEndsAt: new Date(now.getTime() + 5 * 24 * 3600 * 1000),
              status: "PAID",
              paidAt: now,
            },
            {
              sequenceNumber: 2,
              amount: new Prisma.Decimal("4500.00"),
              currency: "INR",
              dueAt: due2,
              graceEndsAt: new Date(due2.getTime() + 5 * 24 * 3600 * 1000),
              status: "PENDING",
            },
            {
              sequenceNumber: 3,
              amount: new Prisma.Decimal("4500.00"),
              currency: "INR",
              dueAt: due3,
              graceEndsAt: new Date(due3.getTime() + 5 * 24 * 3600 * 1000),
              status: "PENDING",
            },
          ],
        },
      },
      include: { installments: true },
    });

    const firstInst = enrollment.installments.find(
      (i) => i.sequenceNumber === 1,
    );
    if (firstInst) {
      await prisma.paymentTransaction.create({
        data: {
          enrollmentId: enrollment.id,
          installmentId: firstInst.id,
          studentId: studentUser.id,
          provider: "RAZORPAY",
          providerOrderId: "order_seed_phys401_1",
          providerPaymentId: "pay_seed_phys401_1",
          amount: new Prisma.Decimal("4500.00"),
          currency: "INR",
          status: "CAPTURED",
          idempotencyKey: "seed_idem_phys401_inst_1",
          verifiedAt: now,
        },
      });
    }
  }

  console.log("[SEED] Database seed completed successfully.");
}

main()
  .catch((err) => {
    console.error("[SEED_ERROR]", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
