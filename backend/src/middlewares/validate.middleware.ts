import { Request, Response, NextFunction, RequestHandler } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { ApiError } from '../utils/ApiError';

export interface RequestSchema {
  body?: AnyZodObject;
  query?: AnyZodObject;
  params?: AnyZodObject;
}

export function validateRequest(schema: RequestSchema): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.query) {
        req.query = await schema.query.parseAsync(req.query);
      }
      if (schema.params) {
        req.params = await schema.params.parseAsync(req.params);
      }
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.reduce<Record<string, string>>((acc, issue) => {
          const path = issue.path.join('.') || 'request';
          acc[path] = issue.message;
          return acc;
        }, {});
        return next(
          ApiError.badRequest(
            'Request validation failed',
            'VALIDATION_ERROR',
            formattedErrors
          )
        );
      }
      return next(error);
    }
  };
}
