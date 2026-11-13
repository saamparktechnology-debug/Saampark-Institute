import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { EnrollmentsService } from './modules/enrollments/enrollments.service';

async function bootstrap() {
  const app = createApp();

  // Automated 00:00 IST & periodic (15-min) Installment Grace-Period Default & Access Lock Sweep
  const runOverdueSweep = async () => {
    try {
      const res = await EnrollmentsService.sweepOverdueInstallmentsAndLockAccess(null);
      if (res.enrollmentsLockedCount > 0) {
        console.log(
          `[OVERDUE-LOCK-ENGINE] Locked ${res.enrollmentsLockedCount} overdue enrollment(s) at ${res.sweptAt}`
        );
      }
    } catch {
      // Non-fatal if DB is initializing
    }
  };

  void runOverdueSweep();
  const sweepTimer = setInterval(() => void runOverdueSweep(), 15 * 60 * 1000);

  const server = app.listen(env.PORT, () => {
    console.log(
      `[ARGON-LMS-BACKEND] Running in ${env.NODE_ENV} mode on port ${env.PORT} (TZ=${env.DEFAULT_TIMEZONE})`
    );
  });

  const shutdown = async (signal: string) => {
    console.log(`[ARGON-LMS-BACKEND] Received ${signal}. Closing HTTP server and Prisma pool...`);
    clearInterval(sweepTimer);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void bootstrap();
