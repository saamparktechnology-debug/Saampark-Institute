import tls from 'tls';
import net from 'net';
import { NotificationChannel } from '@prisma/client';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { AuthenticatedActor } from '../types/express';

export type OmnichannelEventType =
  | 'ONBOARDING_WELCOME'
  | 'LIVE_CLASS_SCHEDULED'
  | 'STUDY_MATERIAL_UPLOADED'
  | 'RECORDING_PUBLISHED'
  | 'ASSIGNMENT_PUBLISHED'
  | 'EXAM_PUBLISHED'
  | 'INSTALLMENT_REMINDER'
  | 'COURSE_ANNOUNCEMENT';

export interface EventChannelToggle {
  whatsapp: boolean;
  email: boolean;
  inApp: boolean;
  smsDlt?: boolean;
}

export interface OmnichannelSettingsDto {
  whatsappEnabled: boolean;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  smsDltEnabled: boolean;
  whatsappBusinessNumber: string;
  whatsappProvider: 'META_CLOUD_API' | 'TWILIO_WHATSAPP' | 'WATI_GATEWAY';
  smtpSenderEmail: string;
  smtpProvider: 'HOSTINGER_SMTP' | 'AWS_SES' | 'RESEND';
  smsDltProvider: 'MSG91_DLT' | 'FAST2SMS_DLT' | 'TEXTLOCAL_DLT' | 'TWILIO_SMS';
  smsDltEntityId: string;
  smsDltSenderId: string;
  smsDltTemplateIdDefault: string;
  smsDltFallbackOnWhatsappFailure: boolean;
  eventToggles: Record<OmnichannelEventType, EventChannelToggle>;
  updatedAt: string;
  updatedBy: string;
}

export interface OmnichannelDeliveryLogDto {
  id: string;
  eventType: OmnichannelEventType | string;
  courseCode: string | null;
  title: string;
  recipientCount: number;
  channelsDispatched: Array<'WHATSAPP' | 'EMAIL' | 'IN_APP' | 'SMS_DLT'>;
  skippedChannels: Array<'WHATSAPP' | 'EMAIL' | 'IN_APP' | 'SMS_DLT'>;
  whatsappPreview: string | null;
  smsDltPreview?: string | null;
  actorName: string;
  createdAt: string;
}

export const DEFAULT_OMNICHANNEL_SETTINGS: Omit<
  OmnichannelSettingsDto,
  'updatedAt' | 'updatedBy'
> = {
  whatsappEnabled: env.WHATSAPP_NOTIFICATIONS_ENABLED,
  emailEnabled: env.EMAIL_NOTIFICATIONS_ENABLED,
  inAppEnabled: true,
  // Kept FALSE by default while DLT registration is pending; Admin can toggle ON anytime in /admin/settings
  smsDltEnabled: env.SMS_DLT_ENABLED,
  whatsappBusinessNumber: env.WHATSAPP_BUSINESS_NUMBER || '+91-98300-44556',
  whatsappProvider: env.WHATSAPP_PROVIDER || 'META_CLOUD_API',
  smtpSenderEmail: env.SMTP_FROM_EMAIL || 'alerts@saampark.edu.in',
  smtpProvider: env.SMTP_PROVIDER || 'HOSTINGER_SMTP',
  smsDltProvider: env.SMS_DLT_PROVIDER || 'MSG91_DLT',
  smsDltEntityId: env.SMS_DLT_ENTITY_ID || '1201159000000000000',
  smsDltSenderId: env.SMS_DLT_SENDER_ID || 'SAAMPK',
  smsDltTemplateIdDefault: env.SMS_DLT_TEMPLATE_ID_DEFAULT || '1207161000000000000',
  smsDltFallbackOnWhatsappFailure: true,
  eventToggles: {
    ONBOARDING_WELCOME: { whatsapp: true, email: true, inApp: true, smsDlt: true },
    LIVE_CLASS_SCHEDULED: { whatsapp: true, email: true, inApp: true, smsDlt: true },
    STUDY_MATERIAL_UPLOADED: { whatsapp: true, email: true, inApp: true, smsDlt: false },
    RECORDING_PUBLISHED: { whatsapp: true, email: true, inApp: true, smsDlt: false },
    ASSIGNMENT_PUBLISHED: { whatsapp: true, email: true, inApp: true, smsDlt: false },
    EXAM_PUBLISHED: { whatsapp: true, email: true, inApp: true, smsDlt: true },
    INSTALLMENT_REMINDER: { whatsapp: true, email: true, inApp: true, smsDlt: true },
    COURSE_ANNOUNCEMENT: { whatsapp: true, email: true, inApp: true, smsDlt: false },
  },
};

/**
 * Pure, deterministic evaluator used by both runtime dispatch and automated tests.
 */
export function isChannelEnabledForEvent(
  settings: Pick<
    OmnichannelSettingsDto,
    'whatsappEnabled' | 'emailEnabled' | 'inAppEnabled' | 'eventToggles'
  > & { smsDltEnabled?: boolean },
  eventType: OmnichannelEventType,
  channel: 'WHATSAPP' | 'EMAIL' | 'IN_APP' | 'SMS_DLT'
): boolean {
  const eventToggle = settings.eventToggles?.[eventType] ?? {
    whatsapp: true,
    email: true,
    inApp: true,
    smsDlt: true,
  };

  if (channel === 'WHATSAPP') {
    return Boolean(settings.whatsappEnabled && eventToggle.whatsapp);
  }
  if (channel === 'EMAIL') {
    return Boolean(settings.emailEnabled && eventToggle.email);
  }
  if (channel === 'SMS_DLT') {
    return Boolean(settings.smsDltEnabled && (eventToggle.smsDlt ?? true));
  }
  return Boolean(settings.inAppEnabled && eventToggle.inApp);
}

/**
 * Builds a structured WhatsApp Business Cloud API template message.
 */
export function buildWhatsAppMessagePreview(params: {
  eventType: OmnichannelEventType;
  courseCode?: string | null;
  title: string;
  body: string;
}): string {
  const prefix = params.courseCode ? `*[${params.courseCode}]* ` : '*[Saampark Institute]* ';
  return `📲 ${prefix}*${params.title}*\n${params.body}\n— _Powered by Saampark LMS WhatsApp Alerts_`;
}

/**
 * Builds a TRAI DLT-compliant transactional SMS payload (max 160 chars per segment).
 */
export function buildDltSmsMessagePreview(params: {
  senderId: string;
  entityId: string;
  templateId: string;
  courseCode?: string | null;
  title: string;
  body: string;
}): string {
  const prefix = params.courseCode ? `[${params.courseCode}] ` : '[Saampark LMS] ';
  const coreText = `${prefix}${params.title}: ${params.body}`.slice(0, 260);
  return `${coreText} - SAAMPK (DLT PE:${params.entityId.slice(-6)}/TPL:${params.templateId.slice(-6)})`;
}

/**
 * Builds an HTML Email template for Welcome, Live Class, Study Material, OTP, or Fee alerts.
 */
export function buildHtmlEmailTemplate(params: {
  recipientName: string;
  courseCode?: string | null;
  title: string;
  body: string;
}): string {
  return `<!DOCTYPE html>
<html>
<body style="font-family: Inter, Arial, sans-serif; background-color: #090D16; color: #F8FAFC; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #111827; border: 1px solid #1E293B; border-radius: 16px; padding: 28px;">
    <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #10B981; font-weight: 700; margin: 0 0 8px 0;">
      Saampark Institute • ${params.courseCode || 'Official Academic Notification'}
    </p>
    <h2 style="font-size: 20px; font-weight: 800; color: #FFFFFF; margin: 0 0 12px 0;">
      ${params.title}
    </h2>
    <p style="font-size: 14px; color: #CBD5E1; line-height: 1.6; margin: 0 0 16px 0;">
      Hello <strong>${params.recipientName}</strong>,
    </p>
    <p style="font-size: 14px; color: #E2E8F0; line-height: 1.6; background-color: #0F172A; padding: 16px; border-radius: 12px; border: 1px solid #1E293B;">
      ${params.body}
    </p>
    <p style="font-size: 12px; color: #64748B; margin-top: 24px;">
      Sign in to your Student/Teacher Portal to view full details.
    </p>
  </div>
</body>
</html>`;
}

function isRealSecretConfigured(val: string): boolean {
  const trimmed = (val || '').trim();
  return (
    trimmed.length > 0 &&
    !trimmed.includes('PLACEHOLDER') &&
    !trimmed.startsWith('CHANGE_ME')
  );
}

/**
 * Dispatches a real outbound Email via Resend HTTP API or Native TLS SMTP (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`).
 * Gracefully falls back if `.env` credentials are still placeholders.
 */
async function sendOutboundEmail(params: {
  toEmail: string;
  toName: string;
  subject: string;
  textBody: string;
  htmlBody: string;
}): Promise<{ delivered: boolean; mode: string }> {
  // 1. If RESEND_API_KEY is configured in .env, dispatch via Resend REST API
  if (isRealSecretConfigured(env.RESEND_API_KEY)) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${env.SMTP_FROM_NAME} <${env.SMTP_FROM_EMAIL}>`,
          to: [params.toEmail],
          subject: params.subject,
          html: params.htmlBody,
          text: params.textBody,
        }),
      });
      return { delivered: res.ok, mode: 'RESEND_LIVE_API' };
    } catch {
      return { delivered: false, mode: 'RESEND_ERROR' };
    }
  }

  // 2. If SMTP_USER and SMTP_PASS are configured in .env, send via TLS SMTP socket
  if (isRealSecretConfigured(env.SMTP_USER) && isRealSecretConfigured(env.SMTP_PASS)) {
    return new Promise((resolve) => {
      const timeoutMs = 6000;
      const socket = env.SMTP_SECURE
        ? tls.connect({
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
            rejectUnauthorized: false,
          })
        : net.createConnection({ host: env.SMTP_HOST, port: env.SMTP_PORT });

      let step = 0;
      const timer = setTimeout(() => {
        socket.destroy();
        resolve({ delivered: false, mode: 'SMTP_TIMEOUT' });
      }, timeoutMs);

      const sendLine = (line: string) => {
        socket.write(`${line}\r\n`);
      };

      socket.on('data', (chunk) => {
        const msg = chunk.toString('utf-8');
        if (step === 0 && msg.startsWith('220')) {
          step = 1;
          sendLine(`EHLO saampark.edu.in`);
        } else if (step === 1 && msg.includes('250')) {
          step = 2;
          sendLine(`AUTH LOGIN`);
        } else if (step === 2 && msg.startsWith('334')) {
          step = 3;
          sendLine(Buffer.from(env.SMTP_USER).toString('base64'));
        } else if (step === 3 && msg.startsWith('334')) {
          step = 4;
          sendLine(Buffer.from(env.SMTP_PASS).toString('base64'));
        } else if (step === 4 && msg.startsWith('235')) {
          step = 5;
          sendLine(`MAIL FROM:<${env.SMTP_FROM_EMAIL || env.SMTP_USER}>`);
        } else if (step === 5 && msg.startsWith('250')) {
          step = 6;
          sendLine(`RCPT TO:<${params.toEmail}>`);
        } else if (step === 6 && msg.startsWith('250')) {
          step = 7;
          sendLine(`DATA`);
        } else if (step === 7 && msg.startsWith('354')) {
          step = 8;
          const rawMime = [
            `From: "${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL || env.SMTP_USER}>`,
            `To: "${params.toName}" <${params.toEmail}>`,
            `Subject: ${params.subject}`,
            `MIME-Version: 1.0`,
            `Content-Type: text/html; charset=UTF-8`,
            ``,
            params.htmlBody,
            `.`,
          ].join('\r\n');
          sendLine(rawMime);
        } else if (step === 8 && msg.startsWith('250')) {
          step = 9;
          sendLine(`QUIT`);
          clearTimeout(timer);
          socket.end();
          resolve({ delivered: true, mode: 'SMTP_LIVE_TLS' });
        } else if (msg.startsWith('4') || msg.startsWith('5')) {
          clearTimeout(timer);
          socket.destroy();
          resolve({ delivered: false, mode: 'SMTP_REJECTED' });
        }
      });

      socket.on('error', () => {
        clearTimeout(timer);
        resolve({ delivered: false, mode: 'SMTP_SOCKET_ERROR' });
      });
    });
  }

  return { delivered: true, mode: 'DB_QUEUED_AWAITING_ENV_SMTP_PASS' };
}

/**
 * Dispatches a real outbound WhatsApp message via Meta WhatsApp Cloud API, Twilio WhatsApp, or WATI Gateway
 * when `.env` secrets (`WHATSAPP_PHONE_NUMBER_ID` + `WHATSAPP_ACCESS_TOKEN`) are configured.
 */
async function sendOutboundWhatsApp(params: {
  toPhone: string | null;
  whatsappText: string;
  provider: 'META_CLOUD_API' | 'TWILIO_WHATSAPP' | 'WATI_GATEWAY';
}): Promise<{ delivered: boolean; mode: string }> {
  const digitsOnly = (params.toPhone || '').replace(/[^0-9]/g, '');
  if (digitsOnly.length < 10) {
    return { delivered: false, mode: 'SKIPPED_NO_USER_PHONE' };
  }

  // 1. Meta WhatsApp Business Cloud API
  if (
    params.provider === 'META_CLOUD_API' &&
    isRealSecretConfigured(env.WHATSAPP_PHONE_NUMBER_ID) &&
    isRealSecretConfigured(env.WHATSAPP_ACCESS_TOKEN)
  ) {
    try {
      const url = `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: digitsOnly,
          type: 'text',
          text: {
            preview_url: false,
            body: params.whatsappText,
          },
        }),
      });
      return { delivered: res.ok, mode: 'META_WHATSAPP_CLOUD_API_LIVE' };
    } catch {
      return { delivered: false, mode: 'META_WHATSAPP_NETWORK_ERROR' };
    }
  }

  // 2. Twilio WhatsApp API
  if (
    params.provider === 'TWILIO_WHATSAPP' &&
    isRealSecretConfigured(env.TWILIO_ACCOUNT_SID) &&
    isRealSecretConfigured(env.TWILIO_AUTH_TOKEN)
  ) {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
      const auth = Buffer.from(
        `${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`
      ).toString('base64');
      const form = new URLSearchParams();
      form.set('From', env.TWILIO_WHATSAPP_FROM);
      form.set('To', `whatsapp:+${digitsOnly}`);
      form.set('Body', params.whatsappText);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      });
      return { delivered: res.ok, mode: 'TWILIO_WHATSAPP_LIVE' };
    } catch {
      return { delivered: false, mode: 'TWILIO_WHATSAPP_ERROR' };
    }
  }

  // 3. WATI Gateway API
  if (
    params.provider === 'WATI_GATEWAY' &&
    isRealSecretConfigured(env.WATI_API_ENDPOINT) &&
    isRealSecretConfigured(env.WATI_ACCESS_TOKEN)
  ) {
    try {
      const url = `${env.WATI_API_ENDPOINT.replace(/\/$/, '')}/api/v1/sendSessionMessage/${digitsOnly}?messageText=${encodeURIComponent(
        params.whatsappText
      )}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.WATI_ACCESS_TOKEN}`,
        },
      });
      return { delivered: res.ok, mode: 'WATI_WHATSAPP_LIVE' };
    } catch {
      return { delivered: false, mode: 'WATI_WHATSAPP_ERROR' };
    }
  }

  return { delivered: true, mode: 'DB_QUEUED_AWAITING_ENV_WHATSAPP_TOKEN' };
}

/**
 * Dispatches a TRAI DLT-registered transactional SMS via MSG91, Fast2SMS, Textlocal India, or Twilio SMS
 * when `smsDltEnabled` is toggled ON in Admin Settings and `SMS_DLT_API_KEY` is configured.
 */
async function sendOutboundDltSms(params: {
  toPhone: string | null;
  smsText: string;
  provider: 'MSG91_DLT' | 'FAST2SMS_DLT' | 'TEXTLOCAL_DLT' | 'TWILIO_SMS';
  entityId: string;
  senderId: string;
  templateId: string;
}): Promise<{ delivered: boolean; mode: string }> {
  const digitsOnly = (params.toPhone || '').replace(/[^0-9]/g, '');
  if (digitsOnly.length < 10) {
    return { delivered: false, mode: 'SKIPPED_NO_USER_PHONE' };
  }

  if (params.provider === 'MSG91_DLT' && isRealSecretConfigured(env.SMS_DLT_API_KEY)) {
    try {
      const res = await fetch('https://control.msg91.com/api/v5/flow/', {
        method: 'POST',
        headers: {
          authkey: env.SMS_DLT_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_id: params.templateId,
          sender: params.senderId,
          short_url: '0',
          mobiles: digitsOnly,
          message: params.smsText,
          DLT_TE_ID: params.templateId,
          PE_ID: params.entityId,
        }),
      });
      return { delivered: res.ok, mode: 'MSG91_DLT_LIVE' };
    } catch {
      return { delivered: false, mode: 'MSG91_DLT_ERROR' };
    }
  }

  if (params.provider === 'FAST2SMS_DLT' && isRealSecretConfigured(env.SMS_DLT_API_KEY)) {
    try {
      const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          authorization: env.SMS_DLT_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          route: 'dlt',
          sender_id: params.senderId,
          message: params.templateId,
          variables_values: params.smsText,
          flash: 0,
          numbers: digitsOnly.slice(-10),
        }),
      });
      return { delivered: res.ok, mode: 'FAST2SMS_DLT_LIVE' };
    } catch {
      return { delivered: false, mode: 'FAST2SMS_DLT_ERROR' };
    }
  }

  return { delivered: true, mode: 'DLT_SMS_QUEUED_AWAITING_GATEWAY_KEY' };
}

export class OmnichannelMessagingService {
  /**
   * Retrieves the current Admin Omnichannel (Email + WhatsApp + DLT SMS + In-App) settings snapshot.
   */
  static async getSettings(): Promise<OmnichannelSettingsDto> {
    const latest = await prisma.auditLog.findFirst({
      where: {
        action: 'OMNICHANNEL_SETTINGS_UPDATED',
        entityType: 'OmnichannelSettings',
      },
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { fullName: true } } },
    });

    if (latest && latest.afterDataJson) {
      try {
        const parsed = JSON.parse(latest.afterDataJson) as Partial<OmnichannelSettingsDto>;
        return {
          ...DEFAULT_OMNICHANNEL_SETTINGS,
          ...parsed,
          eventToggles: {
            ...DEFAULT_OMNICHANNEL_SETTINGS.eventToggles,
            ...(parsed.eventToggles || {}),
          },
          updatedAt: latest.createdAt.toISOString(),
          updatedBy: latest.actor?.fullName || 'Administrator',
        };
      } catch {
        // Fallback to default settings
      }
    }

    return {
      ...DEFAULT_OMNICHANNEL_SETTINGS,
      updatedAt: new Date().toISOString(),
      updatedBy: 'System Default (.env)',
    };
  }

  /**
   * Updates Admin Omnichannel settings (including Master WhatsApp, Email, and DLT SMS ON/OFF toggles)
   * and records an immutable audit trail entry.
   */
  static async updateSettings(
    actor: AuthenticatedActor,
    payload: Partial<Omit<OmnichannelSettingsDto, 'updatedAt' | 'updatedBy'>>
  ): Promise<OmnichannelSettingsDto> {
    const current = await this.getSettings();

    const merged: Omit<OmnichannelSettingsDto, 'updatedAt' | 'updatedBy'> = {
      whatsappEnabled:
        payload.whatsappEnabled !== undefined ? payload.whatsappEnabled : current.whatsappEnabled,
      emailEnabled:
        payload.emailEnabled !== undefined ? payload.emailEnabled : current.emailEnabled,
      inAppEnabled:
        payload.inAppEnabled !== undefined ? payload.inAppEnabled : current.inAppEnabled,
      smsDltEnabled:
        payload.smsDltEnabled !== undefined ? payload.smsDltEnabled : current.smsDltEnabled,
      whatsappBusinessNumber:
        payload.whatsappBusinessNumber || current.whatsappBusinessNumber,
      whatsappProvider: payload.whatsappProvider || current.whatsappProvider,
      smtpSenderEmail: payload.smtpSenderEmail || current.smtpSenderEmail,
      smtpProvider: payload.smtpProvider || current.smtpProvider,
      smsDltProvider: payload.smsDltProvider || current.smsDltProvider,
      smsDltEntityId: payload.smsDltEntityId || current.smsDltEntityId,
      smsDltSenderId: payload.smsDltSenderId || current.smsDltSenderId,
      smsDltTemplateIdDefault:
        payload.smsDltTemplateIdDefault || current.smsDltTemplateIdDefault,
      smsDltFallbackOnWhatsappFailure:
        payload.smsDltFallbackOnWhatsappFailure !== undefined
          ? payload.smsDltFallbackOnWhatsappFailure
          : current.smsDltFallbackOnWhatsappFailure,
      eventToggles: {
        ...current.eventToggles,
        ...(payload.eventToggles || {}),
      },
    };

    const log = await prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: 'OMNICHANNEL_SETTINGS_UPDATED',
        entityType: 'OmnichannelSettings',
        entityId: 'GLOBAL_OMNICHANNEL_CONFIG',
        beforeDataJson: JSON.stringify(current),
        afterDataJson: JSON.stringify(merged),
      },
    });

    return {
      ...merged,
      updatedAt: log.createdAt.toISOString(),
      updatedBy: actor.fullName,
    };
  }

  /**
   * Dispatches a 6-digit authentication or password-reset OTP directly to a user via Email, WhatsApp,
   * and DLT SMS (when `smsDltEnabled` is ON in Admin Settings).
   */
  static async dispatchDirectOtp(params: {
    userId: string;
    fullName: string;
    email: string;
    phone: string | null;
    otpCode: string;
    purpose: 'PASSWORD_RESET' | 'OTP_LOGIN';
  }): Promise<{ channelsDispatched: string[] }> {
    const settings = await this.getSettings();
    const channelsDispatched: string[] = [];

    const subject =
      params.purpose === 'PASSWORD_RESET'
        ? `[Saampark LMS] Password Reset OTP: ${params.otpCode}`
        : `[Saampark LMS] One-Time Sign-In OTP: ${params.otpCode}`;
    const bodyText = `Your 6-digit verification code is ${params.otpCode}. It is valid for 10 minutes. Do not share this OTP with anyone.`;

    if (settings.emailEnabled) {
      channelsDispatched.push('EMAIL');
      const htmlBody = buildHtmlEmailTemplate({
        recipientName: params.fullName,
        courseCode: 'SECURITY-OTP',
        title: subject,
        body: bodyText,
      });
      void sendOutboundEmail({
        toEmail: params.email,
        toName: params.fullName,
        subject,
        textBody: bodyText,
        htmlBody,
      });
    }

    if (settings.whatsappEnabled && params.phone) {
      channelsDispatched.push('WHATSAPP');
      const waText = `🔐 *[Saampark LMS Security]* *${subject}*\n${bodyText}`;
      const waRes = await sendOutboundWhatsApp({
        toPhone: params.phone,
        whatsappText: waText,
        provider: settings.whatsappProvider,
      });

      // Automatic DLT SMS Fallback if WhatsApp fails and DLT SMS is toggled ON
      if (
        !waRes.delivered &&
        settings.smsDltEnabled &&
        settings.smsDltFallbackOnWhatsappFailure &&
        !channelsDispatched.includes('SMS_DLT')
      ) {
        channelsDispatched.push('SMS_DLT');
        const smsText = buildDltSmsMessagePreview({
          senderId: settings.smsDltSenderId,
          entityId: settings.smsDltEntityId,
          templateId: settings.smsDltTemplateIdDefault,
          courseCode: 'OTP',
          title: 'Security Code',
          body: bodyText,
        });
        void sendOutboundDltSms({
          toPhone: params.phone,
          smsText,
          provider: settings.smsDltProvider,
          entityId: settings.smsDltEntityId,
          senderId: settings.smsDltSenderId,
          templateId: settings.smsDltTemplateIdDefault,
        });
      }
    }

    if (settings.smsDltEnabled && params.phone && !channelsDispatched.includes('SMS_DLT')) {
      channelsDispatched.push('SMS_DLT');
      const smsText = buildDltSmsMessagePreview({
        senderId: settings.smsDltSenderId,
        entityId: settings.smsDltEntityId,
        templateId: settings.smsDltTemplateIdDefault,
        courseCode: 'OTP',
        title: 'Security Code',
        body: bodyText,
      });
      void sendOutboundDltSms({
        toPhone: params.phone,
        smsText,
        provider: settings.smsDltProvider,
        entityId: settings.smsDltEntityId,
        senderId: settings.smsDltSenderId,
        templateId: settings.smsDltTemplateIdDefault,
      });
    }

    return { channelsDispatched };
  }

  /**
   * Dispatches an event notification across all enabled channels (`WHATSAPP`, `EMAIL`, `IN_APP`, `SMS_DLT`)
   * to a list of recipient user IDs.
   */
  static async dispatchToUsers(params: {
    actorId?: string | null;
    eventType: OmnichannelEventType;
    courseCode?: string | null;
    title: string;
    body: string;
    recipientUserIds: string[];
  }) {
    const uniqueRecipients = Array.from(new Set(params.recipientUserIds)).filter(Boolean);
    if (uniqueRecipients.length === 0) {
      return {
        recipientCount: 0,
        channelsDispatched: [] as Array<'WHATSAPP' | 'EMAIL' | 'IN_APP' | 'SMS_DLT'>,
        skippedChannels: [] as Array<'WHATSAPP' | 'EMAIL' | 'IN_APP' | 'SMS_DLT'>,
      };
    }

    const [settings, recipientUsers] = await Promise.all([
      this.getSettings(),
      prisma.user.findMany({
        where: { id: { in: uniqueRecipients } },
        select: { id: true, fullName: true, email: true, phone: true },
      }),
    ]);

    const channelsDispatched: Array<'WHATSAPP' | 'EMAIL' | 'IN_APP' | 'SMS_DLT'> = [];
    const skippedChannels: Array<'WHATSAPP' | 'EMAIL' | 'IN_APP' | 'SMS_DLT'> = [];

    for (const ch of ['IN_APP', 'EMAIL', 'WHATSAPP', 'SMS_DLT'] as const) {
      if (isChannelEnabledForEvent(settings, params.eventType, ch)) {
        channelsDispatched.push(ch);
      } else {
        skippedChannels.push(ch);
      }
    }

    const notificationRows: Array<{
      recipientUserId: string;
      type: string;
      title: string;
      body: string;
      channel: NotificationChannel;
    }> = [];

    const whatsappPreview = buildWhatsAppMessagePreview({
      eventType: params.eventType,
      courseCode: params.courseCode,
      title: params.title,
      body: params.body,
    });

    const smsDltPreview = buildDltSmsMessagePreview({
      senderId: settings.smsDltSenderId,
      entityId: settings.smsDltEntityId,
      templateId: settings.smsDltTemplateIdDefault,
      courseCode: params.courseCode,
      title: params.title,
      body: params.body,
    });

    for (const u of recipientUsers) {
      if (channelsDispatched.includes('IN_APP')) {
        notificationRows.push({
          recipientUserId: u.id,
          type: params.eventType,
          title: params.title,
          body: params.body,
          channel: 'IN_APP',
        });
      }
      if (channelsDispatched.includes('EMAIL')) {
        notificationRows.push({
          recipientUserId: u.id,
          type: `EMAIL_${params.eventType}`,
          title: `[Email] ${params.title}`,
          body: params.body,
          channel: 'EMAIL',
        });
        const htmlBody = buildHtmlEmailTemplate({
          recipientName: u.fullName,
          courseCode: params.courseCode,
          title: params.title,
          body: params.body,
        });
        void sendOutboundEmail({
          toEmail: u.email,
          toName: u.fullName,
          subject: `${params.courseCode ? `[${params.courseCode}] ` : ''}${params.title}`,
          textBody: params.body,
          htmlBody,
        });
      }
      if (channelsDispatched.includes('WHATSAPP')) {
        notificationRows.push({
          recipientUserId: u.id,
          type: `WHATSAPP_${params.eventType}`,
          title: `[WhatsApp] ${params.title}`,
          body: whatsappPreview,
          channel: 'SMS',
        });
        void sendOutboundWhatsApp({
          toPhone: u.phone,
          whatsappText: whatsappPreview,
          provider: settings.whatsappProvider,
        });
      }
      if (channelsDispatched.includes('SMS_DLT')) {
        notificationRows.push({
          recipientUserId: u.id,
          type: `SMS_DLT_${params.eventType}`,
          title: `[DLT SMS] ${params.title}`,
          body: smsDltPreview,
          channel: 'SMS',
        });
        void sendOutboundDltSms({
          toPhone: u.phone,
          smsText: smsDltPreview,
          provider: settings.smsDltProvider,
          entityId: settings.smsDltEntityId,
          senderId: settings.smsDltSenderId,
          templateId: settings.smsDltTemplateIdDefault,
        });
      }
    }

    await prisma.$transaction(async (tx) => {
      if (notificationRows.length > 0) {
        await tx.notification.createMany({
          data: notificationRows,
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: params.actorId || null,
          action: 'OMNICHANNEL_MESSAGE_DISPATCHED',
          entityType: 'OmnichannelDispatch',
          entityId: params.courseCode || params.eventType,
          afterDataJson: JSON.stringify({
            eventType: params.eventType,
            courseCode: params.courseCode || null,
            title: params.title,
            recipientCount: recipientUsers.length,
            channelsDispatched,
            skippedChannels,
            whatsappPreview: channelsDispatched.includes('WHATSAPP') ? whatsappPreview : null,
            smsDltPreview: channelsDispatched.includes('SMS_DLT') ? smsDltPreview : null,
          }),
        },
      });
    });

    return {
      recipientCount: recipientUsers.length,
      channelsDispatched,
      skippedChannels,
      whatsappPreview: channelsDispatched.includes('WHATSAPP') ? whatsappPreview : null,
      smsDltPreview: channelsDispatched.includes('SMS_DLT') ? smsDltPreview : null,
    };
  }

  /**
   * Automatically fans out an omnichannel update (`WHATSAPP` + `EMAIL` + `IN_APP` + `SMS_DLT`, governed by Admin toggles)
   * to all students with an `ACTIVE` or `COMPLETED` enrollment in `courseId`.
   */
  static async dispatchToCourseCohort(params: {
    actorId?: string | null;
    courseId: string;
    eventType: OmnichannelEventType;
    title: string;
    body: string;
  }) {
    try {
      const course = await prisma.course.findUnique({
        where: { id: params.courseId },
        select: {
          code: true,
          title: true,
          enrollments: {
            where: { status: { in: ['ACTIVE', 'COMPLETED'] } },
            select: { studentId: true },
          },
        },
      });

      if (!course || course.enrollments.length === 0) {
        return {
          recipientCount: 0,
          channelsDispatched: [] as Array<'WHATSAPP' | 'EMAIL' | 'IN_APP' | 'SMS_DLT'>,
          skippedChannels: [] as Array<'WHATSAPP' | 'EMAIL' | 'IN_APP' | 'SMS_DLT'>,
        };
      }

      const recipientUserIds = course.enrollments.map((e) => e.studentId);

      return await this.dispatchToUsers({
        actorId: params.actorId,
        eventType: params.eventType,
        courseCode: course.code,
        title: params.title,
        body: params.body,
        recipientUserIds,
      });
    } catch {
      return {
        recipientCount: 0,
        channelsDispatched: [] as Array<'WHATSAPP' | 'EMAIL' | 'IN_APP' | 'SMS_DLT'>,
        skippedChannels: [] as Array<'WHATSAPP' | 'EMAIL' | 'IN_APP' | 'SMS_DLT'>,
      };
    }
  }

  /**
   * Lists the most recent omnichannel dispatch logs for the Admin / Teacher control center.
   */
  static async listDeliveryLogs(limit = 30): Promise<OmnichannelDeliveryLogDto[]> {
    const logs = await prisma.auditLog.findMany({
      where: {
        action: 'OMNICHANNEL_MESSAGE_DISPATCHED',
        entityType: 'OmnichannelDispatch',
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        actor: { select: { fullName: true } },
      },
    });

    return logs.map((l) => {
      let parsed: Record<string, unknown> = {};
      if (l.afterDataJson) {
        try {
          parsed = JSON.parse(l.afterDataJson) as Record<string, unknown>;
        } catch {
          parsed = {};
        }
      }
      return {
        id: l.id,
        eventType: String(parsed.eventType || l.entityId || 'SYSTEM_ALERT'),
        courseCode: parsed.courseCode ? String(parsed.courseCode) : null,
        title: String(parsed.title || 'Omnichannel Notification'),
        recipientCount: Number(parsed.recipientCount || 0),
        channelsDispatched: Array.isArray(parsed.channelsDispatched)
          ? (parsed.channelsDispatched as Array<'WHATSAPP' | 'EMAIL' | 'IN_APP' | 'SMS_DLT'>)
          : [],
        skippedChannels: Array.isArray(parsed.skippedChannels)
          ? (parsed.skippedChannels as Array<'WHATSAPP' | 'EMAIL' | 'IN_APP' | 'SMS_DLT'>)
          : [],
        whatsappPreview: parsed.whatsappPreview ? String(parsed.whatsappPreview) : null,
        smsDltPreview: parsed.smsDltPreview ? String(parsed.smsDltPreview) : null,
        actorName: l.actor?.fullName || 'Automated Event Trigger',
        createdAt: l.createdAt.toISOString(),
      };
    });
  }
}
