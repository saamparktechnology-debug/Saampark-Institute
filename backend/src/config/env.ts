import dotenv from 'dotenv';

dotenv.config();

/**
 * Strips any accidental surrounding double or single quotes from .env values.
 */
export function cleanEnvValue(raw: string | undefined, fallback = ''): string {
  if (!raw) return fallback;
  return raw.trim().replace(/^["']+|["']+$/g, '').trim();
}

export interface AppEnv {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  CORS_ORIGIN: string;
  DEFAULT_TIMEZONE: string;
  DATABASE_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_DAYS: number;
  COOKIE_SECURE: boolean;

  // Razorpay Payment Gateway Configuration
  RAZORPAY_KEY_ID: string;
  RAZORPAY_KEY_SECRET: string;
  RAZORPAY_WEBHOOK_SECRET: string;

  // Indian GST & Section 194J TDS Tax Compliance Configuration
  INSTITUTE_STATE: string;
  INSTITUTE_GSTIN: string;
  INSTITUTE_SAC_CODE: string;
  DEFAULT_TEACHER_TDS_PERCENT: number;

  // Local VPS File Upload Storage Configuration
  STORAGE_DRIVER: string;
  LOCAL_UPLOAD_DIR: string;

  // Email (SMTP / Resend API) Configuration
  EMAIL_NOTIFICATIONS_ENABLED: boolean;
  SMTP_PROVIDER: 'HOSTINGER_SMTP' | 'AWS_SES' | 'RESEND';
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_SECURE: boolean;
  SMTP_USER: string;
  SMTP_PASS: string;
  SMTP_FROM_NAME: string;
  SMTP_FROM_EMAIL: string;
  RESEND_API_KEY: string;

  // WhatsApp Business Cloud API / Twilio / WATI Configuration
  WHATSAPP_NOTIFICATIONS_ENABLED: boolean;
  WHATSAPP_PROVIDER: 'META_CLOUD_API' | 'TWILIO_WHATSAPP' | 'WATI_GATEWAY';
  WHATSAPP_BUSINESS_NUMBER: string;
  WHATSAPP_API_VERSION: string;
  WHATSAPP_PHONE_NUMBER_ID: string;
  WHATSAPP_ACCESS_TOKEN: string;
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_WHATSAPP_FROM: string;
  WATI_API_ENDPOINT: string;
  WATI_ACCESS_TOKEN: string;

  // Indian DLT SMS Gateway Configuration (Master Toggle OFF by default while DLT registration is pending)
  SMS_DLT_ENABLED: boolean;
  SMS_DLT_PROVIDER: 'MSG91_DLT' | 'FAST2SMS_DLT' | 'TEXTLOCAL_DLT' | 'TWILIO_SMS';
  SMS_DLT_ENTITY_ID: string;
  SMS_DLT_SENDER_ID: string;
  SMS_DLT_TEMPLATE_ID_DEFAULT: string;
  SMS_DLT_API_KEY: string;
}

function requireEnv(key: string, fallbackInDev?: string): string {
  const val = cleanEnvValue(process.env[key], fallbackInDev);
  if (!val) {
    throw new Error(`[CONFIG_ERROR] Missing required environment variable: ${key}`);
  }
  return val;
}

const nodeEnv = (cleanEnvValue(process.env.NODE_ENV, 'development') ||
  'development') as AppEnv['NODE_ENV'];
const isDevOrTest = nodeEnv !== 'production';

export const env: AppEnv = {
  NODE_ENV: nodeEnv,
  PORT: Number(cleanEnvValue(process.env.PORT, '4000')),
  CORS_ORIGIN: requireEnv('CORS_ORIGIN', isDevOrTest ? 'http://localhost:3000' : undefined),
  DEFAULT_TIMEZONE: cleanEnvValue(process.env.DEFAULT_TIMEZONE, 'Asia/Kolkata'),
  DATABASE_URL: requireEnv(
    'DATABASE_URL',
    isDevOrTest ? 'mysql://lms_user:password@127.0.0.1:3306/argon_lms_db' : undefined
  ),
  JWT_ACCESS_SECRET: requireEnv(
    'JWT_ACCESS_SECRET',
    isDevOrTest ? 'dev_only_jwt_access_secret_32_characters_minimum' : undefined
  ),
  JWT_REFRESH_SECRET: requireEnv(
    'JWT_REFRESH_SECRET',
    isDevOrTest ? 'dev_only_jwt_refresh_secret_32_characters_minimum' : undefined
  ),
  JWT_ACCESS_EXPIRES_IN: cleanEnvValue(process.env.JWT_ACCESS_EXPIRES_IN, '15m'),
  JWT_REFRESH_EXPIRES_DAYS: Number(cleanEnvValue(process.env.JWT_REFRESH_EXPIRES_DAYS, '7')),
  COOKIE_SECURE:
    cleanEnvValue(process.env.COOKIE_SECURE) === 'true' || nodeEnv === 'production',

  // Razorpay Payment Gateway
  RAZORPAY_KEY_ID: cleanEnvValue(process.env.RAZORPAY_KEY_ID, 'rzp_test_PLACEHOLDER'),
  RAZORPAY_KEY_SECRET: cleanEnvValue(
    process.env.RAZORPAY_KEY_SECRET,
    'RAZORPAY_SECRET_PLACEHOLDER'
  ),
  RAZORPAY_WEBHOOK_SECRET: cleanEnvValue(
    process.env.RAZORPAY_WEBHOOK_SECRET,
    'RAZORPAY_WEBHOOK_SECRET_PLACEHOLDER'
  ),

  // Indian GST & Section 194J TDS Tax Compliance
  INSTITUTE_STATE: cleanEnvValue(process.env.INSTITUTE_STATE, 'West Bengal'),
  INSTITUTE_GSTIN: cleanEnvValue(process.env.INSTITUTE_GSTIN, '19AABCS1429B1Z1'),
  INSTITUTE_SAC_CODE: cleanEnvValue(process.env.INSTITUTE_SAC_CODE, '999293'),
  DEFAULT_TEACHER_TDS_PERCENT: Number(
    cleanEnvValue(process.env.DEFAULT_TEACHER_TDS_PERCENT, '10')
  ),

  // Local VPS Storage
  STORAGE_DRIVER: cleanEnvValue(process.env.STORAGE_DRIVER, 'LOCAL_VPS'),
  LOCAL_UPLOAD_DIR: cleanEnvValue(process.env.LOCAL_UPLOAD_DIR, './uploads'),

  // Email (SMTP / Resend API)
  EMAIL_NOTIFICATIONS_ENABLED:
    cleanEnvValue(process.env.EMAIL_NOTIFICATIONS_ENABLED, 'true') !== 'false',
  SMTP_PROVIDER:
    (cleanEnvValue(process.env.SMTP_PROVIDER, 'HOSTINGER_SMTP') as AppEnv['SMTP_PROVIDER']) ||
    'HOSTINGER_SMTP',
  SMTP_HOST: cleanEnvValue(process.env.SMTP_HOST, 'smtp.hostinger.com'),
  SMTP_PORT: Number(cleanEnvValue(process.env.SMTP_PORT, '465')),
  SMTP_SECURE: cleanEnvValue(process.env.SMTP_SECURE, 'true') !== 'false',
  SMTP_USER: cleanEnvValue(process.env.SMTP_USER, ''),
  SMTP_PASS: cleanEnvValue(process.env.SMTP_PASS, ''),
  SMTP_FROM_NAME: cleanEnvValue(process.env.SMTP_FROM_NAME, 'Saampark Institute LMS'),
  SMTP_FROM_EMAIL: cleanEnvValue(process.env.SMTP_FROM_EMAIL, 'alerts@saampark.edu.in'),
  RESEND_API_KEY: cleanEnvValue(process.env.RESEND_API_KEY, ''),

  // WhatsApp Business API (Meta Cloud API / Twilio / WATI)
  WHATSAPP_NOTIFICATIONS_ENABLED:
    cleanEnvValue(process.env.WHATSAPP_NOTIFICATIONS_ENABLED, 'true') !== 'false',
  WHATSAPP_PROVIDER:
    (cleanEnvValue(process.env.WHATSAPP_PROVIDER, 'META_CLOUD_API') as AppEnv['WHATSAPP_PROVIDER']) ||
    'META_CLOUD_API',
  WHATSAPP_BUSINESS_NUMBER: cleanEnvValue(
    process.env.WHATSAPP_BUSINESS_NUMBER,
    '+91-98300-44556'
  ),
  WHATSAPP_API_VERSION: cleanEnvValue(process.env.WHATSAPP_API_VERSION, 'v20.0'),
  WHATSAPP_PHONE_NUMBER_ID: cleanEnvValue(process.env.WHATSAPP_PHONE_NUMBER_ID, ''),
  WHATSAPP_ACCESS_TOKEN: cleanEnvValue(process.env.WHATSAPP_ACCESS_TOKEN, ''),
  TWILIO_ACCOUNT_SID: cleanEnvValue(process.env.TWILIO_ACCOUNT_SID, ''),
  TWILIO_AUTH_TOKEN: cleanEnvValue(process.env.TWILIO_AUTH_TOKEN, ''),
  TWILIO_WHATSAPP_FROM: cleanEnvValue(
    process.env.TWILIO_WHATSAPP_FROM,
    'whatsapp:+14155238886'
  ),
  WATI_API_ENDPOINT: cleanEnvValue(process.env.WATI_API_ENDPOINT, ''),
  WATI_ACCESS_TOKEN: cleanEnvValue(process.env.WATI_ACCESS_TOKEN, ''),

  // Indian DLT SMS Gateway (OFF by default while DLT registration is pending)
  SMS_DLT_ENABLED: cleanEnvValue(process.env.SMS_DLT_ENABLED, 'false') === 'true',
  SMS_DLT_PROVIDER:
    (cleanEnvValue(process.env.SMS_DLT_PROVIDER, 'MSG91_DLT') as AppEnv['SMS_DLT_PROVIDER']) ||
    'MSG91_DLT',
  SMS_DLT_ENTITY_ID: cleanEnvValue(
    process.env.SMS_DLT_ENTITY_ID,
    '1201159000000000000'
  ),
  SMS_DLT_SENDER_ID: cleanEnvValue(process.env.SMS_DLT_SENDER_ID, 'SAAMPK'),
  SMS_DLT_TEMPLATE_ID_DEFAULT: cleanEnvValue(
    process.env.SMS_DLT_TEMPLATE_ID_DEFAULT,
    '1207161000000000000'
  ),
  SMS_DLT_API_KEY: cleanEnvValue(process.env.SMS_DLT_API_KEY, ''),
};
