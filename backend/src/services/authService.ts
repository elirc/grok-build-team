// =============================================================================
// AUTH SERVICE
// =============================================================================
// This layer contains the business logic for authentication.
//
// Why a service layer?
// - Keeps authentication logic reusable
// - Easier to test in isolation
// - Routes stay focused on HTTP concerns only
//
// Security notes:
// - We use bcrypt for password hashing (industry standard)
// - Never log passwords or tokens
// - JWT secret should come from environment variables (never hardcode)
// =============================================================================

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRES_IN = '7d';

interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

interface LoginInput {
  email: string;
  password: string;
}

export async function registerUser(input: RegisterInput) {
  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existingUser) {
    throw new Error('User with this email already exists');
  }

  // Hash the password before storing it
  // 10 is the salt rounds - a good balance between security and performance
  const passwordHash = await bcrypt.hash(input.password, 10);

  // Create the user
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      name: input.name,
    },
  });

  // Generate JWT token
  const token = jwt.sign(
    { 
      userId: user.id, 
      email: user.email 
    }, 
    JWT_SECRET, 
    { expiresIn: JWT_EXPIRES_IN }
  );

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    token,
  };
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user) {
    throw new Error('Invalid credentials');
  }

  // Compare the provided password with the stored hash
  const isValidPassword = await bcrypt.compare(input.password, user.passwordHash);

  if (!isValidPassword) {
    throw new Error('Invalid credentials');
  }

  const token = jwt.sign(
    { 
      userId: user.id, 
      email: user.email 
    }, 
    JWT_SECRET, 
    { expiresIn: JWT_EXPIRES_IN }
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
  };
}
