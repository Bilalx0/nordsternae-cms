import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { promisify } from 'util';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import sgMail from '@sendgrid/mail';
import { users, refreshTokens, passwordResetTokens } from '../shared/schema.js';
import { db } from '../server/storage.js';
import { v4 as uuidv4 } from 'uuid';

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

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
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

// Config
export const config = {
  api: {
    bodyParser: false,
  },
};

// Environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'your-super-secret-refresh-key';
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL;
const SENDGRID_FROM_EMAIL = 'digitalassist@nordstern.ae'; // Verified SendGrid sender

// Configure Cloudinary
cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

// Email template for password reset
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
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">🔒 Password Reset Request</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Nordstern Digital Solutions</p>
        </div>
        <!-- Main Content -->
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
        <!-- Footer -->
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

// Utility Functions
const generateTokens = (userId: string): AuthTokens => {
  const accessToken = jwt.sign(
    { userId, type: 'access' },
    JWT_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 12);
};

const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

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

const parseMultipartData = (body: Buffer, boundary: string): { fields: Record<string, any>, files: Record<string, any> } => {
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const fields: Record<string, any> = {};
  const files: Record<string, any> = {};

  const parts = body.toString('binary').split(`--${boundary}`);

  parts.forEach(partStr => {
    if (!partStr.trim() || partStr.endsWith('--\r\n')) return;

    const partBuffer = Buffer.from(partStr, 'binary');
    const headerEndIndex = partBuffer.indexOf('\r\n\r\n');

    if (headerEndIndex === -1) return;

    const headersStr = partBuffer.slice(0, headerEndIndex).toString('utf8');
    const contentBuffer = partBuffer.slice(headerEndIndex + 4);

    const dispositionMatch = headersStr.match(/Content-Disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]+)")?/i);

    if (dispositionMatch) {
      const fieldName = dispositionMatch[1];
      const filename = dispositionMatch[2];

      if (filename) {
        const contentTypeMatch = headersStr.match(/Content-Type:\s*(.+)/i);
        const contentType = contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream';
        const cleanBuffer = contentBuffer.slice(0, contentBuffer.length - 2);

        files[fieldName] = {
          buffer: cleanBuffer,
          mimetype: contentType,
          originalname: filename,
          size: cleanBuffer.length
        };
      } else {
        const content = contentBuffer.slice(0, contentBuffer.length - 2).toString('utf8');
        fields[fieldName] = content;
      }
    }
  });

  return { fields, files };
};

// Middleware
const authenticateToken = async (req: ServerlessRequest): Promise<{ success: boolean; error?: string; user?: User }> => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return { success: false, error: 'Access token required' };
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;

    if (decoded.type !== 'access') {
      return { success: false, error: 'Invalid token type' };
    }

    const user = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);

    if (!user.length) {
      return { success: false, error: 'User not found' };
    }

    return { success: true, user: user[0] };
  } catch (error) {
    console.error("Authenticate token error:", error);
    return { success: false, error: 'Invalid or expired token' };
  }
};

// Forgot Password Handler
export const forgotPassword = async (req: ServerlessRequest): Promise<ServerlessResponse> => {
  try {
    if (req.method !== 'POST') {
      return createResponse(405, { error: 'Method not allowed' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { email } = body;

    if (!email || !validateEmail(email)) {
      return createResponse(200, { message: 'If an account exists with this email, a password reset link has been sent' });
    }

    const user = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);

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
    } catch (emailError) {
      console.error('[POST /api/auth/forgot-password] SendGrid error:', emailError);
      if (emailError.response?.body?.errors) {
        console.error('[POST /api/auth/forgot-password] SendGrid errors:', emailError.response.body.errors);
      }
      // Continue with success response to prevent enumeration
    }

    return createResponse(200, { message: 'If an account exists with this email, a password reset link has been sent' });
  } catch (error) {
    console.error('[POST /api/auth/forgot-password] Error:', error);
    return createResponse(500, { error: 'Internal server error' });
  }
};

// Verify Reset Token Handler
export const verifyResetToken = async (req: ServerlessRequest): Promise<ServerlessResponse> => {
  try {
    if (req.method !== 'POST') {
      return createResponse(405, { error: 'Method not allowed' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { token } = body;

    if (!token) {
      return createResponse(400, { error: 'Reset token is required' });
    }

    const resetToken = await db.select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token))
      .limit(1);

    if (!resetToken.length) {
      return createResponse(400, { error: 'Invalid or expired reset token' });
    }

    if (new Date() > resetToken[0].expiresAt) {
      await db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, token));
      return createResponse(400, { error: 'Reset token has expired' });
    }

    return createResponse(200, { message: 'Reset token is valid' });
  } catch (error) {
    console.error('[POST /api/auth/verify-reset-token] Error:', error);
    return createResponse(500, { error: 'Internal server error' });
  }
};

// Reset Password Handler
export const resetPassword = async (req: ServerlessRequest): Promise<ServerlessResponse> => {
  try {
    if (req.method !== 'POST') {
      return createResponse(405, { error: 'Method not allowed' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { token, newPassword } = body;

    if (!token || !newPassword) {
      return createResponse(400, { error: 'Reset token and new password are required' });
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return createResponse(400, { error: passwordValidation.message });
    }

    const resetToken = await db.select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token))
      .limit(1);

    if (!resetToken.length) {
      return createResponse(400, { error: 'Invalid or expired reset token' });
    }

    if (new Date() > resetToken[0].expiresAt) {
      await db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, token));
      return createResponse(400, { error: 'Reset token has expired' });
    }

    const hashedPassword = await hashPassword(newPassword);

    await db.update(users)
      .set({
        password: hashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(users.id, resetToken[0].userId));

    await db.delete(refreshTokens).where(eq(refreshTokens.userId, resetToken[0].userId));
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, token));

    return createResponse(200, { message: 'Password reset successfully' });
  } catch (error) {
    console.error('[POST /api/auth/reset-password] Error:', error);
    return createResponse(500, { error: 'Internal server error' });
  }
};

// Existing Handlers (unchanged)
export const register = async (req: ServerlessRequest): Promise<ServerlessResponse> => {
  try {
    if (req.method !== 'POST') {
      return createResponse(405, { error: 'Method not allowed' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { email, password, firstName, lastName } = body;

    if (!email || !password || !firstName || !lastName) {
      return createResponse(400, { error: 'All fields are required' });
    }

    if (!validateEmail(email)) {
      return createResponse(400, { error: 'Invalid email format' });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return createResponse(400, { error: passwordValidation.message });
    }

    const existingUser = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);

    if (existingUser.length > 0) {
      return createResponse(409, { error: 'User already exists with this email' });
    }

    const hashedPassword = await hashPassword(password);

    const newUser = await db.insert(users).values({
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName,
      lastName,
      isVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    const tokens = generateTokens(newUser[0].id);

    await db.insert(refreshTokens).values({
      token: tokens.refreshToken,
      userId: newUser[0].id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const { password: _, ...userResponse } = newUser[0];

    return createResponse(201, {
      message: 'User registered successfully',
      user: userResponse,
      tokens
    });
  } catch (error) {
    console.error('[POST /api/auth/register] Error:', error);
    return createResponse(500, { error: 'Internal server error' });
  }
};

export const login = async (req: ServerlessRequest): Promise<ServerlessResponse> => {
  try {
    if (req.method !== 'POST') {
      return createResponse(405, { error: 'Method not allowed' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { email, password } = body;

    if (!email || !password) {
      return createResponse(400, { error: 'Email and password are required' });
    }

    const user = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);

    if (!user.length) {
      return createResponse(401, { error: 'Invalid credentials' });
    }

    const isValidPassword = await comparePassword(password, user[0].password);

    if (!isValidPassword) {
      return createResponse(401, { error: 'Invalid credentials' });
    }

    const tokens = generateTokens(user[0].id);

    await db.insert(refreshTokens).values({
      token: tokens.refreshToken,
      userId: user[0].id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const { password: _, ...userResponse } = user[0];

    return createResponse(200, {
      message: 'Login successful',
      user: userResponse,
      tokens
    });
  } catch (error) {
    console.error('[POST /api/auth/login] Error:', error);
    return createResponse(500, { error: 'Internal server error' });
  }
};

export const refreshToken = async (req: ServerlessRequest): Promise<ServerlessResponse> => {
  try {
    if (req.method !== 'POST') {
      return createResponse(405, { error: 'Method not allowed' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { refreshToken } = body;

    if (!refreshToken) {
      return createResponse(400, { error: 'Refresh token is required' });
    }

    const decoded = jwt.verify(refreshToken, REFRESH_SECRET) as any;

    if (decoded.type !== 'refresh') {
      return createResponse(401, { error: 'Invalid token type' });
    }

    const storedToken = await db.select()
      .from(refreshTokens)
      .where(and(
        eq(refreshTokens.token, refreshToken),
        eq(refreshTokens.userId, decoded.userId)
      ))
      .limit(1);

    if (!storedToken.length) {
      return createResponse(401, { error: 'Invalid refresh token' });
    }

    if (new Date() > storedToken[0].expiresAt) {
      await db.delete(refreshTokens).where(eq(refreshTokens.token, refreshToken));
      return createResponse(401, { error: 'Refresh token expired' });
    }

    const newTokens = generateTokens(decoded.userId);

    await db.delete(refreshTokens).where(eq(refreshTokens.token, refreshToken));
    await db.insert(refreshTokens).values({
      token: newTokens.refreshToken,
      userId: decoded.userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return createResponse(200, {
      message: 'Tokens refreshed successfully',
      tokens: newTokens
    });
  } catch (error) {
    console.error('[POST /api/auth/refresh] Error:', error);
    return createResponse(401, { error: 'Invalid refresh token' });
  }
};

export const logout = async (req: ServerlessRequest): Promise<ServerlessResponse> => {
  try {
    if (req.method !== 'POST') {
      return createResponse(405, { error: 'Method not allowed' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { refreshToken } = body;

    if (refreshToken) {
      await db.delete(refreshTokens).where(eq(refreshTokens.token, refreshToken));
    }

    return createResponse(200, { message: 'Logout successful' });
  } catch (error) {
    console.error('[POST /api/auth/logout] Error:', error);
    return createResponse(500, { error: 'Internal server error' });
  }
};

export const getProfile = async (req: ServerlessRequest): Promise<ServerlessResponse> => {
  try {
    if (req.method !== 'GET') {
      return createResponse(405, { error: 'Method not allowed' });
    }

    const auth = await authenticateToken(req);
    if (!auth.success) {
      return createResponse(401, { error: auth.error });
    }

    const { password: _, ...userResponse } = auth.user!;
    return createResponse(200, { user: userResponse });
  } catch (error) {
    console.error('[GET /api/auth/profile] Error:', error);
    return createResponse(500, { error: 'Internal server error' });
  }
};

export const updateProfile = async (req: ServerlessRequest): Promise<ServerlessResponse> => {
  try {
    if (req.method !== 'PUT') {
      return createResponse(405, { error: 'Method not allowed' });
    }

    const auth = await authenticateToken(req);
    if (!auth.success) {
      return createResponse(401, { error: auth.error });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { firstName, lastName, email } = body;
    const userId = auth.user!.id;

    const updateData: any = { updatedAt: new Date() };

    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (email) {
      if (!validateEmail(email)) {
        return createResponse(400, { error: 'Invalid email format' });
      }

      const existingUser = await db.select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      if (existingUser.length > 0 && existingUser[0].id !== userId) {
        return createResponse(409, { error: 'Email already taken' });
      }

      updateData.email = email.toLowerCase();
    }

    const updatedUser = await db.update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();

    const { password: _, ...userResponse } = updatedUser[0];

    return createResponse(200, {
      message: 'Profile updated successfully',
      user: userResponse
    });
  } catch (error) {
    console.error('[PUT /api/auth/profile] Error:', error);
    return createResponse(500, { error: 'Internal server error' });
  }
};

export const uploadProfileImage = async (req: ServerlessRequest): Promise<ServerlessResponse> => {
  try {
    if (req.method !== 'POST') {
      return createResponse(405, { error: 'Method not allowed' });
    }

    const auth = await authenticateToken(req);
    if (!auth.success) {
      return createResponse(401, { error: auth.error });
    }

    const contentType = req.headers['content-type'] || req.headers['Content-Type'];
    if (!contentType?.includes('multipart/form-data')) {
      return createResponse(400, { error: 'Content-Type must be multipart/form-data' });
    }

    if (!req.rawBody || !req.boundary) {
      console.error('[POST /api/auth/upload-profile-image] Missing rawBody or boundary in request for multipart/form-data.');
      return createResponse(400, { error: 'Missing raw request body or multipart boundary. This is an internal server configuration issue.' });
    }

    const { files } = parseMultipartData(req.rawBody, req.boundary);

    const file = files.profileImage;
    if (!file || !file.buffer) {
      return createResponse(400, { error: 'No valid image file provided or file buffer missing' });
    }

    if (!file.mimetype?.startsWith('image/')) {
      return createResponse(400, { error: 'Only image files are allowed' });
    }

    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return createResponse(400, { error: `File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB` });
    }

    const userId = auth.user!.id;

    const stream = new Readable();
    stream.push(file.buffer);
    stream.push(null);

    const cloudinaryResult: any = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'profile-images',
          transformation: [
            { width: 300, height: 300, crop: 'fill', gravity: 'face' },
            { quality: 'auto', fetch_format: 'auto' }
          ]
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.pipe(uploadStream);
    });

    const updatedUser = await db.update(users)
      .set({
        profileImage: cloudinaryResult.secure_url,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();

    const { password: _, ...userResponse } = updatedUser[0];

    return createResponse(200, {
      message: 'Profile image uploaded successfully',
      user: userResponse,
      imageUrl: cloudinaryResult.secure_url
    });
  } catch (error: any) {
    console.error('[POST /api/auth/upload-profile-image] Error:', {
      message: error.message,
      stack: error.stack,
      cloudinaryConfig: {
        cloud_name: CLOUDINARY_CLOUD_NAME,
        api_key: CLOUDINARY_API_KEY ? 'configured' : 'missing',
        api_secret: CLOUDINARY_API_SECRET ? 'configured' : 'missing'
      }
    });
    return createResponse(500, { error: 'Failed to upload profile image', details: error.message });
  }
};

export const changePassword = async (req: ServerlessRequest): Promise<ServerlessResponse> => {
  try {
    if (req.method !== 'PUT') {
      return createResponse(405, { error: 'Method not allowed' });
    }

    const auth = await authenticateToken(req);
    if (!auth.success) {
      return createResponse(401, { error: auth.error });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { currentPassword, newPassword } = body;
    const userId = auth.user!.id;

    if (!currentPassword || !newPassword) {
      return createResponse(400, { error: 'Current password and new password are required' });
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return createResponse(400, { error: passwordValidation.message });
    }

    const isValidPassword = await comparePassword(currentPassword, auth.user!.password);

    if (!isValidPassword) {
      return createResponse(401, { error: 'Current password is incorrect' });
    }

    const hashedNewPassword = await hashPassword(newPassword);

    await db.update(users)
      .set({
        password: hashedNewPassword,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));

    await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));

    return createResponse(200, { message: 'Password changed successfully' });
  } catch (error) {
    console.error('[PUT /api/auth/change-password] Error:', error);
    return createResponse(500, { error: 'Internal server error' });
  }
};

export const deleteAccount = async (req: ServerlessRequest): Promise<ServerlessResponse> => {
  try {
    if (req.method !== 'DELETE') {
      return createResponse(405, { error: 'Method not allowed' });
    }

    const auth = await authenticateToken(req);
    if (!auth.success) {
      return createResponse(401, { error: auth.error });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { password } = body;
    const userId = auth.user!.id;

    if (!password) {
      return createResponse(400, { error: 'Password is required to delete account' });
    }

    const isValidPassword = await comparePassword(password, auth.user!.password);

    if (!isValidPassword) {
      return createResponse(401, { error: 'Incorrect password' });
    }

    await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
    await db.delete(users).where(eq(users.id, userId));

    return createResponse(200, { message: 'Account deleted successfully' });
  } catch (error) {
    console.error('[DELETE /api/auth/delete-account] Error:', error);
    return createResponse(500, { error: 'Internal server error' });
  }
};

// Export all handlers and utilities
export {
  authenticateToken,
  generateTokens,
  hashPassword,
  comparePassword,
  validateEmail,
  validatePassword,
  createResponse,
  parseMultipartData
};

// Main Vercel handler
export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  let requestBodyForHandlers: string | Buffer | object;
  let rawBodyBuffer: Buffer | undefined;
  let boundary: string | undefined;

  const contentTypeHeader = req.headers['content-type'] || req.headers['Content-Type'];
  const isMultipart = contentTypeHeader?.includes('multipart/form-data');

  if (isMultipart) {
    rawBodyBuffer = req.body;
    requestBodyForHandlers = rawBodyBuffer;
    const boundaryMatch = contentTypeHeader.match(/boundary=(.+)/i);
    if (boundaryMatch && boundaryMatch[1]) {
      boundary = boundaryMatch[1].replace(/"/g, '').trim();
    }
  } else if (typeof req.body === 'string') {
    try {
      requestBodyForHandlers = JSON.parse(req.body);
    } catch (e) {
      requestBodyForHandlers = req.body;
    }
  } else {
    requestBodyForHandlers = req.body;
  }

  const request: ServerlessRequest = {
    method: req.method,
    headers: req.headers,
    body: requestBodyForHandlers,
    query: req.query,
    url: req.url,
    rawBody: rawBodyBuffer,
    boundary: boundary
  };

  let response: ServerlessResponse;

  const path = req.url.replace('/api/auth', '') || '/';

  switch (path) {
    case '/register':
      response = await register(request);
      break;
    case '/login':
      response = await login(request);
      break;
    case '/refresh':
      response = await refreshToken(request);
      break;
    case '/logout':
      response = await logout(request);
      break;
    case '/profile':
      if (req.method === 'GET') {
        response = await getProfile(request);
      } else if (req.method === 'PUT') {
        response = await updateProfile(request);
      } else {
        response = createResponse(405, { error: 'Method not allowed' });
      }
      break;
    case '/upload-profile-image':
      response = await uploadProfileImage(request);
      break;
    case '/change-password':
      response = await changePassword(request);
      break;
    case '/delete-account':
      response = await deleteAccount(request);
      break;
    case '/forgot-password':
      response = await forgotPassword(request);
      break;
    case '/verify-reset-token':
      response = await verifyResetToken(request);
      break;
    case '/reset-password':
      response = await resetPassword(request);
      break;
    default:
      response = createResponse(404, { error: 'Route not found' });
  }

  if (response.headers) {
    Object.entries(response.headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
  }

  try {
    res.status(response.statusCode).json(JSON.parse(response.body));
  } catch (parseError) {
    console.error('[API Handler] Failed to parse response body as JSON:', parseError, 'Raw body:', response.body);
    res.status(500).json({ error: 'Internal server error: Malformed API response.' });
  }
}