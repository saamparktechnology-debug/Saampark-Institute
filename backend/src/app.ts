import crypto from 'crypto';
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { v1Router } from './routes';
import { razorpayWebhooksRouter } from './modules/payments/payments.module';
import { globalErrorHandler, notFoundHandler } from './middlewares/error.middleware';

export function createApp(): Application {
  const app = express();

  // Attach correlation / request ID to every incoming request
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId =
      (req.headers['x-request-id'] as string | undefined) || crypto.randomUUID();
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
  });

  // Security headers & strict CORS allowlist
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Request-Id',
        'Idempotency-Key',
        'X-Razorpay-Signature',
      ],
    })
  );

  app.use(cookieParser());
  // Support binary/base64 course material & assignment uploads up to 50 MB
  app.use(express.json({ limit: '65mb' }));
  app.use(express.urlencoded({ extended: true, limit: '65mb' }));

  // Mount API v1 routes & top-level /api/webhooks/razorpay alias
  app.use('/api/v1', v1Router);
  app.use('/api/webhooks', razorpayWebhooksRouter);

  // 404 & Global Error Middleware
  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
}
