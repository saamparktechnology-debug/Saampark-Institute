import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./config/prisma";

async function bootstrap() {
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    console.log(
      `[ARGON-LMS-BACKEND] Running in ${env.NODE_ENV} mode on port ${env.PORT} (TZ=${env.DEFAULT_TIMEZONE})`,
    );
  });

  const shutdown = async (signal: string) => {
    console.log(
      `[ARGON-LMS-BACKEND] Received ${signal}. Closing HTTP server and Prisma pool...`,
    );
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void bootstrap();
