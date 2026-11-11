import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { catchAsync } from "../../utils/catchAsync";
import { apiResponse } from "../../utils/apiResponse";
import { ApiError } from "../../utils/ApiError";
import { env } from "../../config/env";

function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
): void {
  res.cookie("argon_access_token", accessToken, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    maxAge: 15 * 60 * 1000,
    path: "/",
  });

  res.cookie("argon_refresh_token", refreshToken, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    maxAge: env.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
    path: "/api/v1/auth",
  });
}

export class AuthController {
  static login = catchAsync(async (req: Request, res: Response) => {
    const result = await AuthService.loginForPanel(req.body, {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      requestId: req.requestId,
    });

    setAuthCookies(res, result.accessToken, result.refreshToken);

    return apiResponse(
      res,
      200,
      `Signed in to ${result.user.role} panel successfully`,
      {
        user: result.user,
        accessToken: result.accessToken,
        redirectTo: result.redirectTo,
      },
    );
  });

  static registerStudent = catchAsync(async (req: Request, res: Response) => {
    const result = await AuthService.registerStudent(req.body, {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      requestId: req.requestId,
    });

    setAuthCookies(res, result.accessToken, result.refreshToken);

    return apiResponse(res, 201, "Student account created successfully", {
      user: result.user,
      accessToken: result.accessToken,
      redirectTo: result.redirectTo,
    });
  });

  static refresh = catchAsync(async (req: Request, res: Response) => {
    const rawRefreshToken =
      (req.cookies?.argon_refresh_token as string | undefined) ||
      (req.body?.refreshToken as string | undefined);

    if (!rawRefreshToken) {
      throw ApiError.unauthorized("Refresh token missing", "AUTH_UNAUTHORIZED");
    }

    const rotated = await AuthService.refreshSession(rawRefreshToken);
    setAuthCookies(res, rotated.accessToken, rotated.refreshToken);

    return apiResponse(res, 200, "Session refreshed successfully", {
      accessToken: rotated.accessToken,
    });
  });

  static me = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized();
    }
    return apiResponse(res, 200, "Authenticated profile retrieved", {
      user: req.user,
    });
  });

  static logout = catchAsync(async (req: Request, res: Response) => {
    if (req.user) {
      await AuthService.logoutSession(req.user.sessionId, req.user.id);
    }
    res.clearCookie("argon_access_token", { path: "/" });
    res.clearCookie("argon_refresh_token", { path: "/api/v1/auth" });
    return apiResponse(res, 200, "Logged out successfully", null);
  });
}
