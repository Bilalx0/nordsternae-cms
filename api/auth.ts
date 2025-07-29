import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { promisify } from 'util';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream'; // Import Readable for stream conversion
import { users, refreshTokens } from '../shared/schema.js'; // Assuming your schema exports these tables
import { db } from '../server/storage.js'; // Assuming your db connection is here

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
  body: string | any; // For non-multipart bodies
  query: Record<string, string>;
  url?: string;
  user?: User;
  // New properties for multipart handling
  rawBody?: Buffer; // The raw request body buffer for multipart
  boundary?: string; // The boundary string for multipart
}

interface ServerlessResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}

export const config = {
  api: {
    bodyParser: false, // Ensure raw body is available for multipart processing
  },
};

// Environment variables validation
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'your-super-secret-refresh-key';
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

// Configure Cloudinary
cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

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

// Removed uploadToCloudinary that accepted filePath, now using streams

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

// Response helper
const createResponse = (statusCode: number, data: any, headers: Record<string, string> = {}): ServerlessResponse => {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      ...headers
    },
    body: JSON.stringify(data)
  };
};

// Fixed multipart parser for Vercel, adjusted to work with Buffer input primarily
const parseMultipartData = (body: Buffer, boundary: string): { fields: Record<string, any>, files: Record<string, any> } => {
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const fields: Record<string, any> = {};
  const files: Record<string, any> = {};

  // Split by boundary, handling potential trailing --\r\n-- or --\r\n
  const parts = body.toString('binary').split(`--${boundary}`);

  parts.forEach(partStr => {
    // Skip empty parts and the last trailing boundary marker
    if (!partStr.trim() || partStr.endsWith('--\r\n')) return;

    const partBuffer = Buffer.from(partStr, 'binary');
    const headerEndIndex = partBuffer.indexOf('\r\n\r\n');

    if (headerEndIndex === -1) return;

    const headersStr = partBuffer.slice(0, headerEndIndex).toString('utf8');
    const contentBuffer = partBuffer.slice(headerEndIndex + 4); // +4 for \r\n\r\n

    const dispositionMatch = headersStr.match(/Content-Disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]+)")?/i);

    if (dispositionMatch) {
      const fieldName = dispositionMatch[1];
      const filename = dispositionMatch[2];

      if (filename) {
        // This is a file
        const contentTypeMatch = headersStr.match(/Content-Type:\s*(.+)/i);
        const contentType = contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream';

        // Remove trailing \r\n from contentBuffer (each part ends with \r\n)
        const cleanBuffer = contentBuffer.slice(0, contentBuffer.length - 2);

        files[fieldName] = {
          buffer: cleanBuffer,
          mimetype: contentType,
          originalname: filename,
          size: cleanBuffer.length
        };
      } else {
        // This is a regular field
        // Remove trailing \r\n from contentBuffer
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

// Auth Handlers
export const register = async (req: ServerlessRequest): Promise<ServerlessResponse> => {
  try {
    if (req.method !== 'POST') {
      return createResponse(405, { error: 'Method not allowed' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { email, password, firstName, lastName } = body;

    // Validation
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

    // Check if user exists
    const existingUser = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);

    if (existingUser.length > 0) {
      return createResponse(409, { error: 'User already exists with this email' });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const newUser = await db.insert(users).values({
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName,
      lastName,
      isVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    // Generate tokens
    const tokens = generateTokens(newUser[0].id);

    // Store refresh token
    await db.insert(refreshTokens).values({
      token: tokens.refreshToken,
      userId: newUser[0].id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    // Remove password from response
    const { password: _, ...userResponse } = newUser[0];

    return createResponse(201, {
      message: 'User registered successfully',
      user: userResponse,
      tokens
    });
  } catch (error) {
    console.error('Registration error:', error);
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

    // Find user
    const user = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);

    if (!user.length) {
      return createResponse(401, { error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user[0].password);

    if (!isValidPassword) {
      return createResponse(401, { error: 'Invalid credentials' });
    }

    // Generate tokens
    const tokens = generateTokens(user[0].id);

    // Store refresh token
    await db.insert(refreshTokens).values({
      token: tokens.refreshToken,
      userId: user[0].id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    // Remove password from response
    const { password: _, ...userResponse } = user[0];

    return createResponse(200, {
      message: 'Login successful',
      user: userResponse,
      tokens
    });
  } catch (error) {
    console.error('Login error:', error);
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

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, REFRESH_SECRET) as any;

    if (decoded.type !== 'refresh') {
      return createResponse(401, { error: 'Invalid token type' });
    }

    // Check if refresh token exists in database
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

    // Check if token is expired
    if (new Date() > storedToken[0].expiresAt) {
      // Delete expired token
      await db.delete(refreshTokens).where(eq(refreshTokens.token, refreshToken));
      return createResponse(401, { error: 'Refresh token expired' });
    }

    // Generate new tokens
    const newTokens = generateTokens(decoded.userId);

    // Update refresh token in database
    await db.delete(refreshTokens).where(eq(refreshTokens.token, refreshToken));
    await db.insert(refreshTokens).values({
      token: newTokens.refreshToken,
      userId: decoded.userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    return createResponse(200, {
      message: 'Tokens refreshed successfully',
      tokens: newTokens
    });
  } catch (error) {
    console.error('Refresh token error:', error);
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
      // Delete refresh token from database
      await db.delete(refreshTokens).where(eq(refreshTokens.token, refreshToken));
    }

    return createResponse(200, { message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
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
    console.error('Profile fetch error:', error);
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

      // Check if email is already taken by another user
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
    console.error('Profile update error:', error);
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

    // Ensure rawBody and boundary are present from the main handler
    if (!req.rawBody || !req.boundary) {
      console.error('Missing rawBody or boundary in request for multipart/form-data.');
      return createResponse(400, { error: 'Missing raw request body or multipart boundary. This is an internal server configuration issue.' });
    }

    // Parse form data using the custom parseMultipartData function
    const { files } = parseMultipartData(req.rawBody, req.boundary);

    // Check if profileImage file exists
    const file = files.profileImage;
    if (!file || !file.buffer) { // Ensure buffer exists
      return createResponse(400, { error: 'No valid image file provided or file buffer missing' });
    }

    // Validate file type
    if (!file.mimetype?.startsWith('image/')) {
      return createResponse(400, { error: 'Only image files are allowed' });
    }

    // Validate file size (redundant if client-side compression and limit are good, but good practice)
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit
    if (file.size > MAX_FILE_SIZE) {
      return createResponse(400, { error: `File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB` });
    }

    const userId = auth.user!.id;

    // Convert buffer to Readable stream for Cloudinary upload
    const stream = new Readable();
    stream.push(file.buffer);
    stream.push(null); // Mark end of stream

    // Upload to Cloudinary using stream
    const cloudinaryResult: any = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'profile-images', // Define your Cloudinary folder
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

    // Update user profile with new image URL
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
    console.error('Profile image upload error:', {
      message: error.message,
      stack: error.stack,
      cloudinaryConfig: {
        cloud_name: CLOUDINARY_CLOUD_NAME,
        api_key: CLOUDINARY_API_KEY ? 'configured' : 'missing',
        api_secret: CLOUDINARY_API_SECRET ? 'configured' : 'missing'
      }
    });
    // Ensure the error response is always JSON
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

    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return createResponse(400, { error: passwordValidation.message });
    }

    // Verify current password
    const isValidPassword = await comparePassword(currentPassword, auth.user!.password);

    if (!isValidPassword) {
      return createResponse(401, { error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedNewPassword = await hashPassword(newPassword);

    // Update password
    await db.update(users)
      .set({
        password: hashedNewPassword,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));

    // Invalidate all refresh tokens for this user
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));

    return createResponse(200, { message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
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

    // Verify password
    const isValidPassword = await comparePassword(password, auth.user!.password);

    if (!isValidPassword) {
      return createResponse(401, { error: 'Incorrect password' });
    }

    // Delete user's refresh tokens
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));

    // Delete user account
    await db.delete(users).where(eq(users.id, userId));

    return createResponse(200, { message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
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
  parseMultipartData // Still exported for consistency if needed elsewhere
};

// Main Vercel handler
export default async function handler(req: any, res: any) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  let requestBodyForHandlers: string | Buffer | object; // Will hold the parsed JSON or raw buffer
  let rawBodyBuffer: Buffer | undefined; // Will hold the raw buffer for multipart
  let boundary: string | undefined;

  const contentTypeHeader = req.headers['content-type'] || req.headers['Content-Type'];
  const isMultipart = contentTypeHeader?.includes('multipart/form-data');

  if (isMultipart) {
    // Vercel's `req.body` for multipart/form-data is usually the raw buffer.
    rawBodyBuffer = req.body; // Store the raw buffer
    requestBodyForHandlers = rawBodyBuffer; // Pass raw buffer to handlers
    const boundaryMatch = contentTypeHeader.match(/boundary=(.+)/i);
    if (boundaryMatch && boundaryMatch[1]) {
      boundary = boundaryMatch[1].replace(/"/g, '').trim();
    }
  } else if (typeof req.body === 'string') {
    // For non-multipart, attempt JSON parsing
    try {
      requestBodyForHandlers = JSON.parse(req.body);
    } catch (e) {
      requestBodyForHandlers = req.body; // Keep as string if not valid JSON
    }
  } else {
    requestBodyForHandlers = req.body; // Already parsed by micro or other middleware
  }

  const request: ServerlessRequest = {
    method: req.method,
    headers: req.headers,
    body: requestBodyForHandlers,
    query: req.query,
    url: req.url,
    rawBody: rawBodyBuffer, // Pass the raw buffer
    boundary: boundary // Pass the boundary
  };

  let response: ServerlessResponse;

  // Extract the path after /api/auth
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
    default:
      response = createResponse(404, { error: 'Route not found' });
  }

  // Set response headers
  if (response.headers) {
    Object.entries(response.headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
  }

  // Safely parse the response body, assuming it's always JSON from createResponse
  // If response.body is not valid JSON (e.g., from an uncaught server error before createResponse),
  // this will throw, but hopefully createResponse always ensures JSON.
  try {
    res.status(response.statusCode).json(JSON.parse(response.body));
  } catch (parseError) {
    console.error("Failed to parse response body as JSON before sending:", parseError, "Raw body:", response.body);
    res.status(500).json({ error: "Internal server error: Malformed API response." });
  }
}