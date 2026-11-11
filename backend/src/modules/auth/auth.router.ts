import { Router } from "express";
import { AuthController } from "./auth.controller";
import { validateRequest } from "../../middlewares/validate.middleware";
import { loginValidation, studentSignupValidation } from "./auth.validation";
import { authenticate } from "../../middlewares/auth.middleware";

export const authRouter = Router();

// Shared authentication endpoints supporting the 4 distinct role login pages
authRouter.post(
  "/login",
  validateRequest(loginValidation),
  AuthController.login,
);
authRouter.post(
  "/student/register",
  validateRequest(studentSignupValidation),
  AuthController.registerStudent,
);
authRouter.post("/refresh", AuthController.refresh);
authRouter.get("/me", authenticate, AuthController.me);
authRouter.post("/logout", authenticate, AuthController.logout);
