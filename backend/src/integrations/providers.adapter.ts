import crypto from 'crypto';

// ============================================================================
// 1. Live Video Provider Adapter (100ms First Evaluation - C-004, C-030)
// ============================================================================

export interface CreateLiveRoomInput {
  courseId: string;
  liveClassId: string;
  title: string;
}

export interface GenerateRoomTokenInput {
  roomId: string;
  userId: string;
  role: 'host' | 'co-host' | 'guest-student';
  expiresInSeconds?: number;
}

export interface LiveVideoProvider {
  readonly providerName: 'HMS_100MS';
  createRoom(input: CreateLiveRoomInput): Promise<{ providerRoomId: string }>;
  generateShortLivedRoomToken(input: GenerateRoomTokenInput): Promise<{ token: string; expiresAt: string }>;
  verifyWebhookSignature(rawBody: string, signatureHeader: string): boolean;
}

export class Hms100msVideoAdapter implements LiveVideoProvider {
  public readonly providerName = 'HMS_100MS' as const;

  constructor(
    private readonly accessKey: string,
    private readonly appSecret: string,
    private readonly webhookSecret: string
  ) {}

  async createRoom(input: CreateLiveRoomInput): Promise<{ providerRoomId: string }> {
    return {
      providerRoomId: `hms_room_${input.liveClassId.slice(0, 8)}`,
    };
  }

  async generateShortLivedRoomToken(
    input: GenerateRoomTokenInput
  ): Promise<{ token: string; expiresAt: string }> {
    const ttl = input.expiresInSeconds ?? 900; // 15 minutes short-lived token
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
    const payload = Buffer.from(
      JSON.stringify({
        access_key: this.accessKey,
        room_id: input.roomId,
        user_id: input.userId,
        role: input.role,
        exp: Math.floor(Date.now() / 1000) + ttl,
      })
    ).toString('base64url');
    const sig = crypto
      .createHmac('sha256', this.appSecret)
      .update(payload)
      .digest('base64url');
    return {
      token: `${payload}.${sig}`,
      expiresAt,
    };
  }

  verifyWebhookSignature(rawBody: string, signatureHeader: string): boolean {
    if (!signatureHeader || !this.webhookSecret) return false;
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signatureHeader);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
}

// ============================================================================
// 2. Payment Provider Adapter (Razorpay - C-009, C-030)
// ============================================================================

export interface CreatePaymentOrderInput {
  enrollmentId: string;
  installmentId?: string;
  amountInPaise: number;
  currency: string;
  idempotencyKey: string;
}

export interface PaymentProvider {
  readonly providerName: 'RAZORPAY';
  createOrder(input: CreatePaymentOrderInput): Promise<{ providerOrderId: string }>;
  verifyWebhookSignature(rawBody: string, signatureHeader: string): boolean;
}

export class RazorpayPaymentAdapter implements PaymentProvider {
  public readonly providerName = 'RAZORPAY' as const;

  constructor(
    private readonly keyId: string,
    private readonly keySecret: string,
    private readonly webhookSecret: string
  ) {}

  async createOrder(input: CreatePaymentOrderInput): Promise<{ providerOrderId: string }> {
    const hash = crypto
      .createHash('sha256')
      .update(`${this.keyId}:${input.idempotencyKey}:${input.amountInPaise}`)
      .digest('hex')
      .slice(0, 14);
    return { providerOrderId: `order_${hash}` };
  }

  verifyWebhookSignature(rawBody: string, signatureHeader: string): boolean {
    if (!signatureHeader || !this.webhookSecret) return false;
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signatureHeader);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
}

// ============================================================================
// 3. YouTube Safe Recorded Class Embed Builder (C-022)
// ============================================================================

const YOUTUBE_VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

export function buildSafeYouTubeEmbedUrl(videoId: string): string {
  if (!YOUTUBE_VIDEO_ID_REGEX.test(videoId)) {
    throw new Error('Invalid YouTube video identifier format');
  }
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
}
