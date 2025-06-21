import { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { storage } from '../server/storage.js';
import * as schema from '../shared/schema.js';
import { validateBody } from '../server/utils.js';

// Extend VercelRequest to include Multer's file property
interface MulterRequest extends VercelRequest {
  file?: any; // TODO: Install @types/express and replace 'any' with Express.Multer.File
}

// Environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Multer for file uploads
const storageConfig = multer.memoryStorage();
const upload = multer({
  storage: storageConfig,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (
    req: Express.Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
  ) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
}).single('profileImage');

// Utility Functions
const generateTokens = (userId: number) => {
  const accessToken = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
};

const verifyToken = (token: string, secret: string) => {
  try {
    return jwt.verify(token, secret) as { userId: number };
  } catch (error) {
    return null;
  }
};

const validateEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password: string) => {
  return password && password.length >= 6;
};

// Authentication Middleware
const authenticateToken = async (
  req: VercelRequest,
  res: VercelResponse
): Promise<number | null> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return null;
  }

  const decoded = verifyToken(token, JWT_SECRET);
  if (!decoded) {
    res.status(403).json({ error: 'Invalid or expired token' });
    return null;
  }

  return decoded.userId;
};

// Run Multer middleware
const runMulter = (req: MulterRequest, res: VercelResponse): Promise<void> => {
  return new Promise((resolve, reject) => {
    upload(req, res, (err: any) => {
      if (err instanceof multer.MulterError) {
        res.status(400).json({ error: 'File upload error: ' + err.message });
        return reject(err);
      } else if (err) {
        res.status(400).json({ error: err.message });
        return reject(err);
      }
      resolve();
    });
  });
};

// Main handler
export default async function handler(req: MulterRequest, res: VercelResponse) {
  console.log('=== AUTH API HANDLER START ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Parse URL and extract endpoint
    if (!req.url) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const urlParts = req.url.split('/').filter((part) => part && part !== 'api' && part !== 'auth');
    const endpoint = urlParts[0] || '';

    // Route handling
    switch (endpoint) {
      // Health Check: /api/auth/health
      case 'health':
        if (req.method === 'GET') {
          return res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
        }
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ error: 'Method not allowed' });

      // Register: /api/auth/register
      case 'register':
        if (req.method === 'POST') {
          const body = validateBody<{
            email?: string;
            password?: string;
            firstName?: string;
            lastName?: string;
          }>(req, res);
          const { email, password, firstName, lastName } = body;
          if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({ error: 'All fields are required' });
          }

          if (!validateEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
          }

          if (!validatePassword(password)) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
          }

          const existingUser = await storage.getUserByUsername(email);
          if (existingUser) {
            return res.status(409).json({ error: 'User already exists' });
          }

          const newUser = await storage.createUser({ email, password, firstName, lastName });
          const userId = newUser.id;
          const { accessToken, refreshToken } = generateTokens(userId);

          await storage.createRefreshToken(userId, refreshToken);

          return res.status(201).json({
            message: 'User registered successfully',
            user: {
              id: userId,
              email: newUser.email,
              firstName: newUser.firstName,
              lastName: newUser.lastName,
              profileImage: newUser.profileImage,
            },
            accessToken,
            refreshToken,
          });
        }
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: 'Method not allowed' });

      // Login: /api/auth/login
      case 'login':
        if (req.method === 'POST') {
          const body = validateBody<{
            email?: string;
            password?: string;
          }>(req, res);
          const { email, password } = body;
          if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
          }

          const user = await storage.getUserByUsername(email);
          if (!user || !user.isActive) {
            return res.status(401).json({ error: 'Invalid credentials' });
          }

          const isPasswordValid = await bcrypt.compare(password, user.password);
          if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
          }

          const userId = user.id;
          const { accessToken, refreshToken } = generateTokens(userId);

          await storage.createRefreshToken(userId, refreshToken);

          return res.json({
            message: 'Login successful',
            user: {
              id: userId,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              profileImage: user.profileImage,
            },
            accessToken,
            refreshToken,
          });
        }
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: 'Method not allowed' });

      // Refresh Token: /api/auth/refresh
      case 'refresh':
        if (req.method === 'POST') {
          const body = validateBody<{
            refreshToken?: string;
          }>(req, res);
          const { refreshToken } = body;
          if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token required' });
          }

          const decoded = verifyToken(refreshToken, JWT_REFRESH_SECRET);
          if (!decoded) {
            return res.status(403).json({ error: 'Invalid refresh token' });
          }

          const storedToken = await storage.getRefreshToken(refreshToken);
          if (!storedToken) {
            return res.status(403).json({ error: 'Refresh token not found' });
          }

          if (new Date() > storedToken.expiresAt) {
            await storage.deleteRefreshToken(refreshToken);
            return res.status(403).json({ error: 'Refresh token expired' });
          }

          const { accessToken, refreshToken: newRefreshToken } = generateTokens(decoded.userId);
          await storage.updateRefreshToken(refreshToken, newRefreshToken);

          return res.json({ accessToken, refreshToken: newRefreshToken });
        }
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: 'Method not allowed' });

      // Logout: /api/auth/logout
      case 'logout':
        if (req.method === 'POST') {
          const userId = await authenticateToken(req, res);
          if (!userId) return;

          const body = validateBody<{
            refreshToken?: string;
          }>(req, res);
          const { refreshToken } = body;
          if (refreshToken) {
            await storage.deleteRefreshToken(refreshToken);
          }

          return res.json({ message: 'Logged out successfully' });
        }
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: 'Method not allowed' });

      // Get User Profile: /api/auth/profile
      case 'profile':
        if (req.method === 'GET') {
          const userId = await authenticateToken(req, res);
          if (!userId) return;

          const user = await storage.getUser(userId);
          if (!user) {
            return res.status(404).json({ error: 'User not found' });
          }

          return res.json({
            user: {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              profileImage: user.profileImage,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt,
            },
          });
        } else if (req.method === 'PUT') {
          const userId = await authenticateToken(req, res);
          if (!userId) return;

          const body = validateBody<{
            firstName?: string;
            lastName?: string;
          }>(req, res);
          const { firstName, lastName } = body;

          const updateData: Partial<schema.InsertUser> = {};
          if (firstName) updateData.firstName = firstName;
          if (lastName) updateData.lastName = lastName;

          const updatedUser = await storage.updateUser(userId, updateData);
          if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
          }

          return res.json({
            message: 'Profile updated successfully',
            user: {
              id: updatedUser.id,
              email: updatedUser.email,
              firstName: updatedUser.firstName,
              lastName: updatedUser.lastName,
              profileImage: updatedUser.profileImage,
              updatedAt: updatedUser.updatedAt,
            },
          });
        }
        res.setHeader('Allow', ['GET', 'PUT']);
        return res.status(405).json({ error: 'Method not allowed' });

      // Profile Image: /api/auth/profile/image
      case 'profile/image':
        if (req.method === 'POST') {
          const userId = await authenticateToken(req, res);
          if (!userId) return;

          await runMulter(req, res);
          if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
          }

          const profileImageUrl = await storage.uploadProfileImage(userId, req.file.buffer);
          return res.json({
            message: 'Profile image uploaded successfully',
            profileImage: profileImageUrl,
          });
        } else if (req.method === 'DELETE') {
          const userId = await authenticateToken(req, res);
          if (!userId) return;

          const success = await storage.deleteProfileImage(userId);
          if (!success) {
            return res.status(400).json({ error: 'No profile image to delete' });
          }

          return res.json({ message: 'Profile image deleted successfully' });
        }
        res.setHeader('Allow', ['POST', 'DELETE']);
        return res.status(405).json({ error: 'Method not allowed' });

      // Change Password: /api/auth/password
      case 'password':
        if (req.method === 'PUT') {
          const userId = await authenticateToken(req, res);
          if (!userId) return;

          const body = validateBody<{
            currentPassword?: string;
            newPassword?: string;
          }>(req, res);
          const { currentPassword, newPassword } = body;

          if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current password and new password are required' });
          }

          if (!validatePassword(newPassword)) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
          }

          const user = await storage.getUser(userId);
          if (!user) {
            return res.status(404).json({ error: 'User not found' });
          }

          const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
          if (!isCurrentPasswordValid) {
            return res.status(400).json({ error: 'Current password is incorrect' });
          }

          await storage.updatePassword(userId, newPassword);
          await storage.deleteAllRefreshTokens(userId);

          return res.json({ message: 'Password changed successfully' });
        }
        res.setHeader('Allow', ['PUT']);
        return res.status(405).json({ error: 'Method not allowed' });

      // Delete Account: /api/auth/account
      case 'account':
        if (req.method === 'DELETE') {
          const userId = await authenticateToken(req, res);
          if (!userId) return;

          const body = validateBody<{
            password?: string;
          }>(req, res);
          const { password } = body;
          if (!password) {
            return res.status(400).json({ error: 'Password confirmation required' });
          }

          const user = await storage.getUser(userId);
          if (!user) {
            return res.status(404).json({ error: 'User not found' });
          }

          const isPasswordValid = await bcrypt.compare(password, user.password);
          if (!isPasswordValid) {
            return res.status(400).json({ error: 'Password is incorrect' });
          }

          await storage.deleteProfileImage(userId);
          await storage.deleteAllRefreshTokens(userId);
          await storage.deleteUser(userId);

          return res.json({ message: 'Account deleted successfully' });
        }
        res.setHeader('Allow', ['DELETE']);
        return res.status(405).json({ error: 'Method not allowed' });

      default:
        return res.status(404).json({ error: 'Route not found' });
    }
  } catch (error: unknown) {
    console.error('Handler error:', error);
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size too large' });
      }
      return res.status(400).json({ error: 'File upload error: ' + error.message });
    } else if (error instanceof Error) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}