import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Prisma, PrismaClient } from '@prisma/client';
import { encryptUpiId, maskUpiId } from '../src/utils/crypto.util';

const prisma = new PrismaClient();

/**
 * Populates the MySQL database with Phase 1–6 records:
 * - 4 Role Users + Profiles + Wallets + Referral Codes
 * - Granular RBAC Permissions & RolePermission mappings
 * - Categories, Published Courses, Multi-Teacher Assignments, Full & Installment Plans
 * - Curriculum Sections, Lessons, and Course Materials
 * - Student Enrollments, Installments, Payment Transactions
 * - Append-Only Wallet Transactions, Attributed/Rewarded Referrals, UPI Redemption Requests, and Teacher Revenue-Share Payout Statements
 * - Phase 4: 100ms Live Classes, Participant Logs, YouTube Class Recordings, Session Attendance Codes (SHA-256), and Attendance Records
 * - Phase 5: Course Assignments, Student Submissions & Teacher Grades, Examinations & Evaluated Attempts, and Verifiable Course Certificates
 * - Phase 6: Support Tickets (INCOMING, IN_TRIAGE, ESCALATED, RESOLVED), Public Replies & Internal Collaboration Notes, and In-App Notifications
 */
async function main() {
  console.log('[SEED] Starting database seed for Online Learning Platform (Phases 1–6)...');

  const passwordHash = await bcrypt.hash('Password123!', 12);

  // 1. Seed Users for all 4 roles
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin.jack@institute.edu' },
    update: {},
    create: {
      email: 'admin.jack@institute.edu',
      phone: '+919000000001',
      passwordHash,
      fullName: 'Jack Anderson (Super Admin)',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });

  const teacherPrimary = await prisma.user.upsert({
    where: { email: 'prof.david@institute.edu' },
    update: {},
    create: {
      email: 'prof.david@institute.edu',
      phone: '+919000000002',
      passwordHash,
      fullName: 'Prof. David S.',
      role: 'TEACHER',
      status: 'ACTIVE',
      teacherProfile: {
        create: {
          teacherCode: 'TCH-2026-001',
          qualification: 'Ph.D. Theoretical Physics & Chemistry',
          specialization: 'Quantum Mechanics & Organic Chemistry',
          defaultRevenueSharePercent: new Prisma.Decimal('30.00'),
        },
      },
    },
  });

  const teacherCo = await prisma.user.upsert({
    where: { email: 'dr.meera@institute.edu' },
    update: {},
    create: {
      email: 'dr.meera@institute.edu',
      phone: '+919000000003',
      passwordHash,
      fullName: 'Dr. Meera Nair',
      role: 'TEACHER',
      status: 'ACTIVE',
      teacherProfile: {
        create: {
          teacherCode: 'TCH-2026-002',
          qualification: 'M.Tech Cyber Security',
          specialization: 'Cryptography & Network Security',
          defaultRevenueSharePercent: new Prisma.Decimal('25.00'),
        },
      },
    },
  });

  const studentUser = await prisma.user.upsert({
    where: { email: 'sarah.student@institute.edu' },
    update: {},
    create: {
      email: 'sarah.student@institute.edu',
      phone: '+919000000004',
      passwordHash,
      fullName: 'Sarah Sen',
      role: 'STUDENT',
      status: 'ACTIVE',
      studentProfile: {
        create: {
          studentCode: 'STU-2026-042',
          gradeLevel: 'Undergraduate Year 3',
        },
      },
      wallet: {
        create: {
          currency: 'INR',
          availableBalance: new Prisma.Decimal('500.00'),
          reservedBalance: new Prisma.Decimal('200.00'),
        },
      },
      referralCode: {
        create: {
          code: 'ARGON-SARAH42',
          isActive: true,
        },
      },
    },
  });

  const referredStudent = await prisma.user.upsert({
    where: { email: 'aarav.referred@institute.edu' },
    update: {},
    create: {
      email: 'aarav.referred@institute.edu',
      phone: '+919000000006',
      passwordHash,
      fullName: 'Aarav Chatterjee',
      role: 'STUDENT',
      status: 'ACTIVE',
      studentProfile: {
        create: {
          studentCode: 'STU-2026-043',
          gradeLevel: 'Undergraduate Year 2',
        },
      },
      wallet: {
        create: {
          currency: 'INR',
          availableBalance: new Prisma.Decimal('0.00'),
          reservedBalance: new Prisma.Decimal('0.00'),
        },
      },
      referralCode: {
        create: {
          code: 'ARGON-AARAV43',
          isActive: true,
        },
      },
    },
  });

  const supportLead = await prisma.user.upsert({
    where: { email: 'captain.support@institute.edu' },
    update: {},
    create: {
      email: 'captain.support@institute.edu',
      phone: '+919000000005',
      passwordHash,
      fullName: 'Rohan Roy (Support Lead)',
      role: 'SUPPORT',
      status: 'ACTIVE',
      supportAgentProfile: {
        create: {
          agentCode: 'SUP-2026-001',
          department: 'BILLING_AND_TRIAGE',
          isTriageLead: true,
          maxConcurrentTickets: 25,
        },
      },
    },
  });

  // 2. Seed Course Categories
  const physicsCategory = await prisma.courseCategory.upsert({
    where: { slug: 'quantum-and-physical-sciences' },
    update: {},
    create: {
      name: 'Quantum & Physical Sciences',
      slug: 'quantum-and-physical-sciences',
      description: 'Advanced physics, chemistry, and mathematical modeling courses.',
      isActive: true,
    },
  });

  const securityCategory = await prisma.courseCategory.upsert({
    where: { slug: 'cyber-and-quantum-security' },
    update: {},
    create: {
      name: 'Cyber & Quantum Security',
      slug: 'cyber-and-quantum-security',
      description: 'Network defense, cryptography, and zero-trust engineering.',
      isActive: true,
    },
  });

  // 3. Seed Published Courses
  const quantumCourse = await prisma.course.upsert({
    where: { code: 'PHYS-401' },
    update: {},
    create: {
      categoryId: physicsCategory.id,
      code: 'PHYS-401',
      title: 'Quantum Physics & Wave Mechanics',
      slug: 'quantum-physics-and-wave-mechanics',
      shortDescription: 'Wave-particle duality, Schrödinger operators & live problem labs.',
      description:
        'Comprehensive cohort course covering Hilbert spaces, quantum operators, perturbation theory, and entanglement.',
      level: 'ADVANCED',
      language: 'English',
      basePrice: new Prisma.Decimal('13500.00'),
      currency: 'INR',
      status: 'PUBLISHED',
      minAttendancePercent: new Prisma.Decimal('75.00'),
      minPassMarksPercent: new Prisma.Decimal('50.00'),
      publishedAt: new Date(),
      createdById: adminUser.id,
    },
  });

  await prisma.course.upsert({
    where: { code: 'CSEC-302' },
    update: {},
    create: {
      categoryId: securityCategory.id,
      code: 'CSEC-302',
      title: 'Zero-Trust Cyber Security Architecture',
      slug: 'zero-trust-cyber-security-architecture',
      shortDescription: 'Network defense, cryptographic protocols & live incident drills.',
      description:
        'Hands-on security engineering covering TLS internals, identity federation, kernel hardening, and threat hunting.',
      level: 'INTERMEDIATE',
      language: 'English',
      basePrice: new Prisma.Decimal('12000.00'),
      currency: 'INR',
      status: 'PUBLISHED',
      minAttendancePercent: new Prisma.Decimal('75.00'),
      minPassMarksPercent: new Prisma.Decimal('50.00'),
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
      assignmentRole: 'PRIMARY',
      revenueSharePercent: new Prisma.Decimal('30.00'),
      status: 'ACTIVE',
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
      assignmentRole: 'CO_INSTRUCTOR',
      revenueSharePercent: new Prisma.Decimal('15.00'),
      status: 'ACTIVE',
    },
  });

  // Payment plan templates
  const existingPlans = await prisma.paymentPlanTemplate.findMany({
    where: { courseId: quantumCourse.id },
  });

  let installmentPlanId = existingPlans.find((p) => p.planType === 'INSTALLMENT')?.id;
  if (!installmentPlanId) {
    const createdPlan = await prisma.paymentPlanTemplate.create({
      data: {
        courseId: quantumCourse.id,
        name: '3-Month Equal Installment Plan',
        planType: 'INSTALLMENT',
        installmentCount: 3,
        totalAmount: new Prisma.Decimal('13500.00'),
        currency: 'INR',
        gracePeriodDays: 5,
        isActive: true,
      },
    });
    installmentPlanId = createdPlan.id;

    await prisma.paymentPlanTemplate.create({
      data: {
        courseId: quantumCourse.id,
        name: 'One-Time Full Payment',
        planType: 'FULL',
        installmentCount: 1,
        totalAmount: new Prisma.Decimal('13500.00'),
        currency: 'INR',
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
    await prisma.courseSection.create({
      data: {
        courseId: quantumCourse.id,
        title: 'Module 1: Foundations of Wave Mechanics',
        description: 'De Broglie wavelength, wave packets, and uncertainty relations.',
        sortOrder: 1,
        lessons: {
          create: [
            {
              title: 'Lecture 1.1: Wave-Particle Duality & Double-Slit Interference',
              contentType: 'VIDEO',
              durationSeconds: 2700,
              sortOrder: 1,
              isPreview: true,
            },
            {
              title: 'Lecture 1.2: Time-Dependent Schrödinger Equation',
              contentType: 'VIDEO',
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
        title: 'Quantum Operators Formula Sheet & Problem Set 1',
        description: 'Reference handbook for Hermitian operators and commutator algebra.',
        fileName: 'quantum_operators_handbook.pdf',
        mimeType: 'application/pdf',
        sizeBytes: BigInt(2458624),
        storageProvider: 'LOCAL_VPS',
        storageKey: `courses/${quantumCourse.id}/materials/quantum_operators_handbook.pdf`,
        uploadedById: teacherPrimary.id,
      },
    });
  }

  // 5. Seed Active Student Enrollment & Verified Payment Transaction
  const existingEnrollment = await prisma.enrollment.findFirst({
    where: { studentId: studentUser.id, courseId: quantumCourse.id },
  });

  let seededEnrollmentId = existingEnrollment?.id;
  if (!existingEnrollment && installmentPlanId) {
    const now = new Date();
    const due2 = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
    const due3 = new Date(now.getTime() + 60 * 24 * 3600 * 1000);

    const enrollment = await prisma.enrollment.create({
      data: {
        studentId: studentUser.id,
        courseId: quantumCourse.id,
        paymentPlanTemplateId: installmentPlanId,
        planTypeSnapshot: 'INSTALLMENT',
        purchasedPriceSnapshot: new Prisma.Decimal('13500.00'),
        currencySnapshot: 'INR',
        status: 'ACTIVE',
        progressPercent: new Prisma.Decimal('88.00'),
        activatedAt: now,
        installments: {
          create: [
            {
              sequenceNumber: 1,
              amount: new Prisma.Decimal('4500.00'),
              currency: 'INR',
              dueAt: now,
              graceEndsAt: new Date(now.getTime() + 5 * 24 * 3600 * 1000),
              status: 'PAID',
              paidAt: now,
            },
            {
              sequenceNumber: 2,
              amount: new Prisma.Decimal('4500.00'),
              currency: 'INR',
              dueAt: due2,
              graceEndsAt: new Date(due2.getTime() + 5 * 24 * 3600 * 1000),
              status: 'PENDING',
            },
            {
              sequenceNumber: 3,
              amount: new Prisma.Decimal('4500.00'),
              currency: 'INR',
              dueAt: due3,
              graceEndsAt: new Date(due3.getTime() + 5 * 24 * 3600 * 1000),
              status: 'PENDING',
            },
          ],
        },
      },
      include: { installments: true },
    });

    seededEnrollmentId = enrollment.id;
    const firstInst = enrollment.installments.find((i) => i.sequenceNumber === 1);
    if (firstInst) {
      await prisma.paymentTransaction.create({
        data: {
          enrollmentId: enrollment.id,
          installmentId: firstInst.id,
          studentId: studentUser.id,
          provider: 'RAZORPAY',
          providerOrderId: 'order_seed_phys401_1',
          providerPaymentId: 'pay_seed_phys401_1',
          amount: new Prisma.Decimal('4500.00'),
          currency: 'INR',
          status: 'CAPTURED',
          idempotencyKey: 'seed_idem_phys401_inst_1',
          receiptNumber: 'RCPT-2026-0001',
          verifiedAt: now,
        },
      });
    }
  }

  // 6. Seed Phase 3 Append-Only Wallet Ledger, Referral, UPI Redemption & Teacher Payout
  const sarahWallet = await prisma.wallet.findUnique({ where: { userId: studentUser.id } });
  const sarahRefCode = await prisma.referralCode.findUnique({ where: { userId: studentUser.id } });

  if (sarahWallet && sarahRefCode) {
    const existingLedgerCount = await prisma.walletTransaction.count({
      where: { walletId: sarahWallet.id },
    });

    if (existingLedgerCount === 0) {
      const referral = await prisma.referral.create({
        data: {
          referrerUserId: studentUser.id,
          referredUserId: referredStudent.id,
          referralCodeId: sarahRefCode.id,
          status: 'REWARDED',
          rewardAmountSnapshot: new Prisma.Decimal('700.00'),
          currency: 'INR',
          qualifyingEnrollmentId: seededEnrollmentId,
          qualifiedAt: new Date(),
          rewardedAt: new Date(),
        },
      });

      await prisma.walletTransaction.create({
        data: {
          walletId: sarahWallet.id,
          transactionType: 'REFERRAL_REWARD',
          direction: 'CREDIT',
          amount: new Prisma.Decimal('700.00'),
          balanceAfter: new Prisma.Decimal('700.00'),
          currency: 'INR',
          status: 'POSTED',
          referenceType: 'Referral',
          referenceId: referral.id,
          idempotencyKey: 'seed_wallet_ref_reward_1',
          description: 'Referral reward for Aarav Chatterjee 1st verified payment',
          createdById: adminUser.id,
        },
      });

      const reserveTx = await prisma.walletTransaction.create({
        data: {
          walletId: sarahWallet.id,
          transactionType: 'REDEMPTION_RESERVE',
          direction: 'DEBIT',
          amount: new Prisma.Decimal('200.00'),
          balanceAfter: new Prisma.Decimal('500.00'),
          currency: 'INR',
          status: 'POSTED',
          referenceType: 'RedemptionRequest',
          referenceId: studentUser.id,
          idempotencyKey: 'seed_wallet_upi_reserve_1',
          description: 'UPI Redemption reservation (sa***h@okaxis)',
          createdById: studentUser.id,
        },
      });

      await prisma.redemptionRequest.create({
        data: {
          userId: studentUser.id,
          walletId: sarahWallet.id,
          amount: new Prisma.Decimal('200.00'),
          currency: 'INR',
          upiIdMasked: maskUpiId('sarah@okaxis'),
          upiIdEncrypted: encryptUpiId('sarah@okaxis'),
          status: 'REQUESTED',
          reserveTransactionId: reserveTx.id,
        },
      });
    }
  }

  const existingPayouts = await prisma.teacherPayout.count({
    where: { teacherId: teacherPrimary.id },
  });
  if (existingPayouts === 0) {
    await prisma.teacherPayout.create({
      data: {
        teacherId: teacherPrimary.id,
        courseId: quantumCourse.id,
        periodStart: new Date('2026-11-01'),
        periodEnd: new Date('2026-11-30'),
        grossCourseCollections: new Prisma.Decimal('4500.00'),
        revenueSharePercentSnapshot: new Prisma.Decimal('30.00'),
        grossPayoutAmount: new Prisma.Decimal('1350.00'),
        adjustments: new Prisma.Decimal('0.00'),
        netPayoutAmount: new Prisma.Decimal('1350.00'),
        currency: 'INR',
        status: 'APPROVED',
        approvedById: adminUser.id,
        notes: '30% Primary Instructor revenue share on verified PHYS-401 collections',
      },
    });
  }

  // 7. Seed Phase 4 Live Classes (100ms), YouTube Recordings & Session Attendance
  const existingLiveCount = await prisma.liveClass.count({
    where: { courseId: quantumCourse.id },
  });

  if (existingLiveCount === 0) {
    const now = new Date();
    const liveStart = new Date(now.getTime() - 15 * 60 * 1000);
    const liveEnd = new Date(now.getTime() + 45 * 60 * 1000);
    const nextClassStart = new Date(now.getTime() + 24 * 3600 * 1000);
    const nextClassEnd = new Date(nextClassStart.getTime() + 60 * 60 * 1000);

    const activeLiveClass = await prisma.liveClass.create({
      data: {
        courseId: quantumCourse.id,
        teacherId: teacherPrimary.id,
        title: 'Live Quantum Lab: Wave Packet Dispersion & Operators',
        description: 'Interactive 100ms problem-solving session on Hermitian operators.',
        scheduledStartAt: liveStart,
        scheduledEndAt: liveEnd,
        provider: 'HMS_100MS',
        providerRoomId: 'hms_room_phys401_live1',
        status: 'LIVE',
      },
    });

    await prisma.liveClass.create({
      data: {
        courseId: quantumCourse.id,
        teacherId: teacherPrimary.id,
        title: 'Lecture 2: Time-Independent Perturbation Theory',
        description: 'Upcoming scheduled live classroom session.',
        scheduledStartAt: nextClassStart,
        scheduledEndAt: nextClassEnd,
        provider: 'HMS_100MS',
        providerRoomId: 'hms_room_phys401_sched2',
        status: 'SCHEDULED',
      },
    });

    await prisma.liveClassParticipant.create({
      data: {
        liveClassId: activeLiveClass.id,
        userId: studentUser.id,
        participantRole: 'STUDENT',
        joinedAt: liveStart,
        durationSeconds: 1800,
      },
    });

    await prisma.classRecording.create({
      data: {
        courseId: quantumCourse.id,
        liveClassId: activeLiveClass.id,
        title: 'Recorded Session: Hilbert Spaces & Dirac Bra-Ket Notation',
        provider: 'YOUTUBE',
        youtubeVideoId: 'M7lc1UVf-VE',
        durationSeconds: 3120,
        status: 'PUBLISHED',
        publishedAt: now,
      },
    });

    const demoAttendanceCode = '482910';
    const demoCodeHash = crypto.createHash('sha256').update(demoAttendanceCode).digest('hex');

    const attendanceSession = await prisma.attendanceSession.create({
      data: {
        courseId: quantumCourse.id,
        liveClassId: activeLiveClass.id,
        teacherId: teacherPrimary.id,
        sessionDate: now,
        startsAt: liveStart,
        endsAt: liveEnd,
        codeHash: demoCodeHash,
        codeExpiresAt: new Date(now.getTime() + 30 * 60 * 1000),
        status: 'OPEN',
      },
    });

    await prisma.attendanceRecord.create({
      data: {
        attendanceSessionId: attendanceSession.id,
        studentId: studentUser.id,
        status: 'PRESENT',
        source: 'CODE',
        markedAt: now,
      },
    });
  }

  // 8. Seed Phase 5 Assignments, Submissions, Exams, Evaluated Attempts & Certificate
  const existingAssignmentCount = await prisma.assignment.count({
    where: { courseId: quantumCourse.id },
  });

  if (existingAssignmentCount === 0) {
    const now = new Date();
    const dueIn3Days = new Date(now.getTime() + 3 * 24 * 3600 * 1000);
    const dueIn7Days = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

    const assignment1 = await prisma.assignment.create({
      data: {
        courseId: quantumCourse.id,
        title: 'Problem Set 1: Commutator Algebra & Ehrenfest Theorem',
        instructions:
          'Derive the canonical commutation relations [x, p_x] = iħ and prove Ehrenfest’s theorem for a 1D harmonic oscillator potential.',
        maxMarks: new Prisma.Decimal('100.00'),
        dueAt: dueIn3Days,
        status: 'PUBLISHED',
        createdById: teacherPrimary.id,
      },
    });

    await prisma.assignment.create({
      data: {
        courseId: quantumCourse.id,
        title: 'Lab Report 2: Finite Square Well Bound State Simulation',
        instructions:
          'Submit your numerical eigenvalue solver write-up and wave-function parity plots.',
        maxMarks: new Prisma.Decimal('100.00'),
        dueAt: dueIn7Days,
        status: 'PUBLISHED',
        createdById: teacherPrimary.id,
      },
    });

    await prisma.assignmentSubmission.create({
      data: {
        assignmentId: assignment1.id,
        studentId: studentUser.id,
        submissionText:
          'Completed derivation of [x, p_x] = iħ acting on test function ψ(x) and verified time-derivative of expectation values.',
        fileStorageKey: `courses/${quantumCourse.id}/assignments/${assignment1.id}/${studentUser.id}-problem_set_1_sarah.pdf`,
        attemptNumber: 1,
        status: 'GRADED',
        marksAwarded: new Prisma.Decimal('92.00'),
        feedback: 'Rigorous operator steps and clean boundary-term justification.',
        gradedById: teacherPrimary.id,
        submittedAt: now,
        gradedAt: now,
      },
    });

    const examPayload = JSON.stringify({
      summary: 'Midterm examination covering Hilbert spaces, Hermitian operators, and wave mechanics.',
      questions: [
        {
          id: 'q1',
          questionType: 'MCQ_SINGLE',
          prompt:
            'Which operator represents the total energy observable in the time-independent Schrödinger equation?',
          marks: 50,
          options: [
            { id: 'q1-a', text: 'Hamiltonian Operator (Ĥ)', isCorrect: true },
            { id: 'q1-b', text: 'Position Operator (x̂)', isCorrect: false },
            { id: 'q1-c', text: 'Momentum Operator (p̂)', isCorrect: false },
          ],
        },
        {
          id: 'q2',
          questionType: 'TRUE_FALSE',
          prompt: 'Eigenvalues of a Hermitian operator are always real numbers.',
          marks: 50,
          options: [
            { id: 'q2-t', text: 'True', isCorrect: true },
            { id: 'q2-f', text: 'False', isCorrect: false },
          ],
        },
      ],
    });

    const midtermExam = await prisma.exam.create({
      data: {
        courseId: quantumCourse.id,
        title: 'PHYS-401 Midterm Examination: Quantum Operators',
        instructions: examPayload,
        durationSeconds: 3600,
        totalMarks: new Prisma.Decimal('100.00'),
        passMarks: new Prisma.Decimal('50.00'),
        attemptLimit: 2,
        startsAt: new Date(now.getTime() - 2 * 3600 * 1000),
        endsAt: new Date(now.getTime() + 14 * 24 * 3600 * 1000),
        resultPublishAt: now,
        status: 'PUBLISHED',
      },
    });

    await prisma.examAttempt.create({
      data: {
        examId: midtermExam.id,
        studentId: studentUser.id,
        attemptNumber: 1,
        status: 'EVALUATED',
        score: new Prisma.Decimal('94.00'),
        grade: 'A+',
        startedAt: now,
        submittedAt: now,
        evaluatedAt: now,
      },
    });

    if (seededEnrollmentId) {
      await prisma.certificate.upsert({
        where: { enrollmentId: seededEnrollmentId },
        update: {},
        create: {
          studentId: studentUser.id,
          courseId: quantumCourse.id,
          enrollmentId: seededEnrollmentId,
          certificateNumber: 'CERT-ARGON-2026-PHYS401-0042',
          status: 'ISSUED',
          fileReference: '/api/v1/certificates/verify/CERT-ARGON-2026-PHYS401-0042',
          issuedAt: now,
        },
      });
    }
  }

  // 9. Seed Phase 6 RBAC Permissions, Support Tickets (Kanban + Internal Notes) & Notifications
  const existingPermCount = await prisma.permission.count();
  if (existingPermCount === 0) {
    const defaultPermissions = [
      {
        code: 'finance.redemption.approve',
        module: 'FINANCE',
        description: 'Approve or reject student UPI wallet redemption requests',
        roles: ['ADMIN'] as const,
      },
      {
        code: 'academics.attendance.override',
        module: 'ACADEMICS',
        description: 'Execute audited manual attendance status overrides',
        roles: ['ADMIN', 'TEACHER'] as const,
      },
      {
        code: 'support.ticket.triage',
        module: 'SUPPORT',
        description: 'Assign, escalate, and resolve incoming support tickets',
        roles: ['ADMIN', 'SUPPORT'] as const,
      },
    ];

    for (const p of defaultPermissions) {
      await prisma.permission.create({
        data: {
          code: p.code,
          module: p.module,
          description: p.description,
          rolePermissions: {
            create: p.roles.map((r) => ({ role: r })),
          },
        },
      });
    }
  }

  const existingTicketsCount = await prisma.supportTicket.count();
  if (existingTicketsCount === 0) {
    const now = new Date();

    const tktIncoming = await prisma.supportTicket.create({
      data: {
        ticketNumber: 'TKT-2026-0101',
        createdById: studentUser.id,
        category: 'PAYMENT_ISSUE',
        priority: 'HIGH',
        status: 'INCOMING',
        subject: 'Installment #2 Razorpay receipt download confirmation',
        description:
          'I need an official GST/institute invoice copy for my upcoming 2nd installment of PHYS-401.',
        slaDueAt: new Date(now.getTime() + 90 * 60 * 1000),
      },
    });

    await prisma.supportTicketMessage.create({
      data: {
        ticketId: tktIncoming.id,
        senderId: studentUser.id,
        message: 'Please share the receipt download link once verified.',
        isInternalNote: false,
      },
    });

    const tktTriage = await prisma.supportTicket.create({
      data: {
        ticketNumber: 'TKT-2026-0102',
        createdById: teacherPrimary.id,
        assignedToId: supportLead.id,
        category: 'LIVE_CLASS_ISSUE',
        priority: 'MEDIUM',
        status: 'IN_TRIAGE',
        subject: '100ms Co-Host token request for guest quantum lab speaker',
        description: 'Requesting co-instructor room permissions for Friday afternoon lab.',
        slaDueAt: new Date(now.getTime() + 6 * 3600 * 1000),
      },
    });

    await prisma.supportTicketMessage.createMany({
      data: [
        {
          ticketId: tktTriage.id,
          senderId: supportLead.id,
          message:
            '[Internal Triage] Verified Dr. Meera Nair is already assigned as CO_INSTRUCTOR in course_teacher_assignments.',
          isInternalNote: true,
        },
        {
          ticketId: tktTriage.id,
          senderId: supportLead.id,
          message:
            'Hi Prof. David, Co-Instructor 100ms host tokens are enabled for your course.',
          isInternalNote: false,
        },
      ],
    });

    await prisma.supportTicket.create({
      data: {
        ticketNumber: 'TKT-2026-0103',
        createdById: referredStudent.id,
        assignedToId: supportLead.id,
        category: 'ENROLLMENT_ISSUE',
        priority: 'URGENT_RED',
        status: 'ESCALATED',
        escalatedTo: 'Finance & Academic Operations Lead',
        subject: 'Urgent installment grace period extension request',
        description:
          'Bank NEFT limit reached today; requesting 48-hour grace extension on CSEC-302.',
        slaDueAt: new Date(now.getTime() + 45 * 60 * 1000),
      },
    });

    await prisma.notification.createMany({
      data: [
        {
          recipientUserId: studentUser.id,
          type: 'ACADEMIC_UPDATE',
          title: 'Problem Set 1 Graded (92/100)',
          body: 'Prof. David S. graded your submission for Problem Set 1: Commutator Algebra.',
          channel: 'IN_APP',
        },
        {
          recipientUserId: teacherPrimary.id,
          type: 'PAYOUT_APPROVED',
          title: 'November Revenue-Share Statement Approved (₹1,350.00)',
          body: 'Your 30% primary instructor revenue-share statement for PHYS-401 has been approved.',
          channel: 'IN_APP',
        },
        {
          recipientUserId: supportLead.id,
          type: 'SLA_ALERT',
          title: 'SLA Breach Risk Alert: TKT-2026-0103',
          body: 'Escalated ticket TKT-2026-0103 is within 45 minutes of its SLA deadline.',
          channel: 'IN_APP',
        },
      ],
    });
  }

  console.log('[SEED] Database seed completed successfully.');
}

main()
  .catch((err) => {
    console.error('[SEED_ERROR]', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
