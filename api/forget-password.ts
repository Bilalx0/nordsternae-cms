import { eq } from 'drizzle-orm';
import sgMail from '@sendgrid/mail';
import { v4 as uuidv4 } from 'uuid';
import { users, passwordResetTokens } from '../shared/schema.js';
import { db } from '../server/storage.js';

// Set SendGrid API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Types
interface User {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  profileImage?: string;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ServerlessRequest {
  method: string;
  headers: Record<string, string>;
  body: string | any;
  query: Record<string, string>;
  url?: string;
  user?: User;
  rawBody?: Buffer;
  boundary?: string;
}

interface ServerlessResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}

// Environment variables
const SENDGRID_FROM_EMAIL = 'digitalassist@nordstern.ae';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://nordsternae.vercel.app';

// Utility Functions
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password: string): { isValid: boolean; message?: string } => {
  if (password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long' };
  }
  if (!/(?=.*[a-z])/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!/(?=.*[A-Z])/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/(?=.*\d)/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one number' };
  }
  return { isValid: true };
};

const hashPassword = async (password: string): Promise<string> => {
  const bcrypt = await import('bcryptjs');
  return bcrypt.hash(password, 12);
};

const createResponse = (statusCode: number, data: any, headers: Record<string, string> = {}): ServerlessResponse => {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      ...headers
    },
    body: JSON.stringify(data)
  };
};

// Email Templates
const generateResetEmailHTML = (user: User, token: string): string => {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`;
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset - Nordstern Digital Solutions</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
      <div style="background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">🔒 Password Reset Request</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Nordstern Digital Solutions</p>
        </div>
        <div style="padding: 30px 20px;">
          <p style="font-size: 18px; color: #2c3e50; margin-top: 0;">
            Hi <strong>${user.firstName}</strong>,
          </p>
          <p style="color: #555; font-size: 16px;">
            We received a request to reset your password. Click the button below to reset it:
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #555; font-size: 16px;">
            If the button doesn't work, you can copy and paste this link into your browser:
            <br>
            <a href="${resetUrl}" style="color: #667eea; text-decoration: none; word-break: break-all;">${resetUrl}</a>
          </p>
          <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #856404; margin: 20px 0;">
            <h3 style="color: #856404; margin-top: 0; font-size: 16px;">⚠️ Security Notice</h3>
            <p style="color: #555; font-size: 14px; margin: 0;">
              This link will expire in 1 hour. If you didn't request this password reset, please ignore this email or contact our support team at <a href="mailto:${SENDGRID_FROM_EMAIL}" style="color: #667eea; text-decoration: none;">${SENDGRID_FROM_EMAIL}</a>.
            </p>
          </div>
        </div>
        <div style="background-color: #2c3e50; color: white; padding: 20px; text-align: center;">
          <p style="margin: 0; font-size: 14px;">
            <strong>Nordstern Digital Solutions</strong>
          </p>
          <p style="margin: 5px 0; font-size: 12px; opacity: 0.8;">
            Email: ${SENDGRID_FROM_EMAIL} | Website: https://nordstern.ae
          </p>
          <p style="margin: 10px 0 0 0; font-size: 11px; opacity: 0.7;">
            This is an automated message. Please do not reply to this email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const generateResetEmailText = (user: User, token: string): string => {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`;
  return `
Hi ${user.firstName},

We received a request to reset your password for your Nordstern Digital Solutions account.

Please click the following link to reset your password:
${resetUrl}

This link will expire in 1 hour for security purposes.

If you did not request a password reset, please ignore this email or contact our support team at ${SENDGRID_FROM_EMAIL}.

Best regards,
The Nordstern Team
Digital Solutions & Innovation

---
Nordstern Digital Solutions
Email: ${SENDGRID_FROM_EMAIL}
Website: https://nordstern.ae

This is an automated message. Please do not reply to this email.
  `.trim();
};

// Handlers
export const forgotPassword = async (req: ServerlessRequest): Promise<ServerlessResponse> => {
  console.log('[POST /api/auth/forgot-password] Received request:', {
    method: req.method,
    headers: req.headers,
    body: req.body
  });

  try {
    if (req.method !== 'POST') {
      console.log('[POST /api/auth/forgot-password] Method not allowed:', req.method);
      return createResponse(405, { error: 'Method not allowed' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { email } = body;

    if (!email || !validateEmail(email)) {
      console.log('[POST /api/auth/forgot-password] Invalid or missing email:', email);
      return createResponse(200, { message: 'If an account exists with this email, a password reset link has been sent' });
    }

    const user = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    console.log('[POST /api/auth/forgot-password] User query result:', user.length ? 'User found' : 'User not found');

    if (!user.length) {
      return createResponse(200, { message: 'If an account exists with this email, a password reset link has been sent' });
    }

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry

    await db.insert(passwordResetTokens).values({
      id: uuidv4(),
      token,
      userId: user[0].id,
      expiresAt,
      createdAt: new Date(),
    });
    console.log('[POST /api/auth/forgot-password] Token created:', { token, userId: user[0].id });

    const msg = {
      to: email,
      from: SENDGRID_FROM_EMAIL,
      subject: 'Password Reset Request - Nordstern Digital Solutions',
      text: generateResetEmailText(user[0], token),
      html: generateResetEmailHTML(user[0], token),
      headers: {
        'X-Reset-Token': token,
        'X-Submission-Time': new Date().toISOString(),
        'X-User-Email': email,
      },
    };

    try {
      await sgMail.send(msg);
      console.log('[POST /api/auth/forgot-password] Reset email sent successfully to:', email);
    } catch (emailError: any) {
      console.error('[POST /api/auth/forgot-password] SendGrid error:', {
        message: emailError.message,
        response: emailError.response?.body?.errors
      });
      // Continue with success response to prevent enumeration
    }

    return createResponse(200, { message: 'If an account exists with this email, a password reset link has been sent' });
  } catch (error: any) {
    console.error('[POST /api/auth/forgot-password] Error:', {
      message: error.message,
      stack: error.stack
    });
    return createResponse(500, { error: 'Internal server error' });
  }
};

export const verifyResetToken = async (req: ServerlessRequest): Promise<ServerlessResponse> => {
  console.log('[POST /api/auth/verify-reset-token] Received request:', {
    method: req.method,
    headers: req.headers,
    body: req.body
  });

  try {
    if (req.method !== 'POST') {
      console.log('[POST /api/auth/verify-reset-token] Method not allowed:', req.method);
      return createResponse(405, { error: 'Method not allowed' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { token } = body;

    if (!token) {
      console.log('[POST /api/auth/verify-reset-token] Missing token');
      return createResponse(400, { error: 'Reset token is required' });
    }

    const resetToken = await db.select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token))
      .limit(1);
    console.log('[POST /api/auth/verify-reset-token] Token query result:', resetToken.length ? 'Token found' : 'Token not found');

    if (!resetToken.length) {
      return createResponse(400, { error: 'Invalid or expired reset token' });
    }

    if (new Date() > resetToken[0].expiresAt) {
      await db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, token));
      console.log('[POST /api/auth/verify-reset-token] Token expired, deleted:', token);
      return createResponse(400, { error: 'Reset token has expired' });
    }

    return createResponse(200, { message: 'Reset token is valid' });
  } catch (error: any) {
    console.error('[POST /api/auth/verify-reset-token] Error:', {
      message: error.message,
      stack: error.stack
    });
    return createResponse(500, { error: 'Internal server error' });
  }
};

export const resetPassword = async (req: ServerlessRequest): Promise<ServerlessResponse> => {
  console.log('[POST /api/auth/reset-password] Received request:', {
    method: req.method,
    headers: req.headers,
    body: req.body
  });

  try {
    if (req.method !== 'POST') {
      console.log('[POST /api/auth/reset-password] Method not allowed:', req.method);
      return createResponse(405, { error: 'Method not allowed' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { token, newPassword } = body;

    if (!token || !newPassword) {
      console.log('[POST /api/auth/reset-password] Missing token or newPassword');
      return createResponse(400, { error: 'Reset token and new password are required' });
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      console.log('[POST /api/auth/reset-password] Invalid password:', passwordValidation.message);
      return createResponse(400, { error: passwordValidation.message });
    }

    const resetToken = await db.select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token))
      .limit(1);
    console.log('[POST /api/auth/reset-password] Token query result:', resetToken.length ? 'Token found' : 'Token not found');

    if (!resetToken.length) {
      return createResponse(400, { error: 'Invalid or expired reset token' });
    }

    if (new Date() > resetToken[0].expiresAt) {
      await db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, token));
      console.log('[POST /api/auth/reset-password] Token expired, deleted:', token);
      return createResponse(400, { error: 'Reset token has expired' });
    }

    const hashedPassword = await hashPassword(newPassword);
    console.log('[POST /api/auth/reset-password] Password hashed successfully');

    await db.update(users)
      .set({
        password: hashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(users.id, resetToken[0].userId));
    console.log('[POST /api/auth/reset-password] User password updated:', resetToken[0].userId);

    await db.delete(refreshTokens).where(eq(refreshTokens.userId, resetToken[0].userId));
    console.log('[POST /api/auth/reset-password] Refresh tokens deleted for user:', resetToken[0].userId);

    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, token));
    console.log('[POST /api/auth/reset-password] Reset token deleted:', token);

    return createResponse(200, { message: 'Password reset successfully' });
  } catch (error: any) {
    console.error('[POST /api/auth/reset-password] Error:', {
      message: error.message,
      stack: error.stack
    });
    return createResponse(500, { error: 'Internal server error' });
  }
};