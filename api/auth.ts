import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
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
  body: string | any;
  query: Record<string, string>;
  url?: string;
  user?: User;
  file?: {
    buffer: Buffer;
    mimetype: string;
    size: number;
    originalname: string;
  };
}

interface ServerlessResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}

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

const uploadToCloudinary = (buffer: Buffer, folder: string = 'profile-images'): Promise<any> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
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
    
    const readable = Readable.from(buffer);
    readable.pipe(stream);
  });
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

// Parse multipart form data for file uploads
const parseMultipartData = (body: string, contentType: string): { fields: Record<string, any>, files: Record<string, any> } => {
  const boundary = contentType.split('boundary=')[1];
  if (!boundary) return { fields: {}, files: {} };

  const parts = body.split(`--${boundary}`);
  const fields: Record<string, any> = {};
  const files: Record<string, any> = {};

  parts.forEach(part => {
    if (part.includes('Content-Disposition')) {
      const lines = part.split('\r\n');
      const dispositionLine = lines.find(line => line.includes('Content-Disposition'));
      
      if (dispositionLine) {
        const nameMatch = dispositionLine.match(/name="([^"]+)"/);
        const filenameMatch = dispositionLine.match(/filename="([^"]+)"/);
        
        if (nameMatch) {
          const fieldName = nameMatch[1];
          const contentStartIndex = part.indexOf('\r\n\r\n') + 4;
          const content = part.substring(contentStartIndex).replace(/\r\n$/, '');
          
          if (filenameMatch) {
            const contentTypeMatch = part.match(/Content-Type: (.+)/);
            files[fieldName] = {
              buffer: Buffer.from(content, 'binary'),
              mimetype: contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream',
              originalname: filenameMatch[1],
              size: Buffer.byteLength(content, 'binary')
            };
          } else {
            fields[fieldName] = content;
          }
        }
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

    const bodyString = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const { fields, files } = parseMultipartData(bodyString, contentType);

    if (!files.profileImage) {
      return createResponse(400, { error: 'No image file provided' });
    }

    const file = files.profileImage;

    // Validate file type
    if (!file.mimetype.startsWith('image/')) {
      return createResponse(400, { error: 'Only image files are allowed' });
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      return createResponse(400, { error: 'File size must be less than 5MB' });
    }

    const userId = auth.user!.id;

    // Upload to Cloudinary
    const cloudinaryResult = await uploadToCloudinary(file.buffer);

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
  } catch (error) {
    console.error('Profile image upload error:', error);
    return createResponse(500, { error: 'Failed to upload profile image' });
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
  uploadToCloudinary,
  createResponse,
  parseMultipartData
};

// Example usage for different serverless platforms:

// For Vercel
export const handler = async (req: any, res: any) => {
  const request: ServerlessRequest = {
    method: req.method,
    headers: req.headers,
    body: req.body,
    query: req.query,
    url: req.url
  };

  let response: ServerlessResponse;

  switch (req.url) {
    case '/api/auth/register':
      response = await register(request);
      break;
    case '/api/auth/login':
      response = await login(request);
      break;
    case '/api/auth/refresh':
      response = await refreshToken(request);
      break;
    case '/api/auth/logout':
      response = await logout(request);
      break;
    case '/api/auth/profile':
      if (req.method === 'GET') {
        response = await getProfile(request);
      } else if (req.method === 'PUT') {
        response = await updateProfile(request);
      } else {
        response = createResponse(405, { error: 'Method not allowed' });
      }
      break;
    case '/api/auth/upload-profile-image':
      response = await uploadProfileImage(request);
      break;
    case '/api/auth/change-password':
      response = await changePassword(request);
      break;
    case '/api/auth/delete-account':
      response = await deleteAccount(request);
      break;
    default:
      response = createResponse(404, { error: 'Route not found' });
  }

  res.status(response.statusCode).json(JSON.parse(response.body));
};

// For AWS Lambda
export const lambdaHandler = async (event: any, context: any) => {
  const request: ServerlessRequest = {
    method: event.httpMethod,
    headers: event.headers,
    body: event.body,
    query: event.queryStringParameters || {},
    url: event.path
  };

  let response: ServerlessResponse;

  switch (event.path) {
    case '/auth/register':
      response = await register(request);
      break;
    case '/auth/login':
      response = await login(request);
      break;
    case '/auth/refresh':
      response = await refreshToken(request);
      break;
    case '/auth/logout':
      response = await logout(request);
      break;
    case '/auth/profile':
      if (event.httpMethod === 'GET') {
        response = await getProfile(request);
      } else if (event.httpMethod === 'PUT') {
        response = await updateProfile(request);
      } else {
        response = createResponse(405, { error: 'Method not allowed' });
      }
      break;
    case '/auth/upload-profile-image':
      response = await uploadProfileImage(request);
      break;
    case '/auth/change-password':
      response = await changePassword(request);
      break;
    case '/auth/delete-account':
      response = await deleteAccount(request);
      break;
    default:
      response = createResponse(404, { error: 'Route not found' });
  }

  return response;
};