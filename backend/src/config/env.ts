import dotenv from "dotenv";

dotenv.config();

export interface AppEnv {
  NODE_ENV: "development" | "test" | "production";
  PORT: number;
  CORS_ORIGIN: string;
  DEFAULT_TIMEZONE: string;
  DATABASE_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_DAYS: number;
  COOKIE_SECURE: boolean;
}

function requireEnv(key: string, fallbackInDev?: string): string {
  const val = process.env[key] || fallbackInDev;
  if (!val) {
    throw new Error(
      `[CONFIG_ERROR] Missing required environment variable: ${key}`,
    );
  }
  return val;
}

const nodeEnv = (process.env.NODE_ENV || "development") as AppEnv["NODE_ENV"];
const isDevOrTest = nodeEnv !== "production";

export const env: AppEnv = {
  NODE_ENV: nodeEnv,
  PORT: Number(process.env.PORT || 4000),
  CORS_ORIGIN: requireEnv(
    "CORS_ORIGIN",
    isDevOrTest ? "http://localhost:3000" : undefined,
  ),
  DEFAULT_TIMEZONE: process.env.DEFAULT_TIMEZONE || "Asia/Kolkata",
  DATABASE_URL: requireEnv(
    "DATABASE_URL",
    isDevOrTest
      ? "mysql://lms_user:password@127.0.0.1:3306/argon_lms_db"
      : undefined,
  ),
  JWT_ACCESS_SECRET: requireEnv(
    "JWT_ACCESS_SECRET",
    isDevOrTest
      ? "dev_only_jwt_access_secret_32_characters_minimum"
      : undefined,
  ),
  JWT_REFRESH_SECRET: requireEnv(
    "JWT_REFRESH_SECRET",
    isDevOrTest
      ? "dev_only_jwt_refresh_secret_32_characters_minimum"
      : undefined,
  ),
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  JWT_REFRESH_EXPIRES_DAYS: Number(process.env.JWT_REFRESH_EXPIRES_DAYS || 7),
  COOKIE_SECURE:
    process.env.COOKIE_SECURE === "true" || nodeEnv === "production",
};
