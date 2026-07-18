// =============================================================================
// AUTH ROUTES
// =============================================================================
// This file handles user registration and login.
//
// EDUCATIONAL NOTES:
// - Routes should be thin. They validate input and call services.
// - Never put business logic or database calls directly in route handlers.
// - This separation makes the code much easier to test and maintain.
//
// Security considerations (important for mid-level):
// - Passwords are never stored in plain text (handled in authService)
// - We use JWT for stateless authentication
// - In a real app you would also implement refresh tokens and proper token rotation
// =============================================================================

import { Router } from 'express';
import { z } from 'zod';
import * as authService from '../services/authService';

const router = Router();

// Validation schemas using Zod
// This is much better than manual validation in every route.
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(2),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    // Validate the request body against our schema
    const data = registerSchema.parse(req.body);
    
    const result = await authService.registerUser(data);
    
    // Never return the password hash to the client
    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
      },
      token: result.token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.errors 
      });
    }
    
    // In a real app you would log this properly
    console.error('Registration error:', error);
    res.status(400).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);
    const result = await authService.loginUser(data);
    
    res.json({
      message: 'Login successful',
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid email or password' });
  }
});

export default router;
