import { RoleType } from '@prisma/client';

export interface AuthenticatedActor {
  id: string;
  email: string;
  fullName: string;
  role: RoleType;
  permissions: string[];
  sessionId: string;
}

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      user?: AuthenticatedActor;
    }
  }
}
