// =============================================================================
// BACKEND ENTRY POINT - grokbuildteamproject
// =============================================================================
// This file starts the Express server.
//
// EDUCATIONAL NOTES:
// - We keep this file small and clean. All real logic lives in other layers.
// - This is intentional. A common junior mistake is putting everything in index.ts or app.ts.
// - The server setup should be minimal: middleware + route mounting + start listening.
//
// Key architectural decisions visible here:
// 1. We use Express (simple and widely used)
// 2. We load environment variables early
// 3. CORS is enabled for development (React frontend runs on different port)
// 4. JSON body parsing is enabled globally
//
// In a more advanced setup we would add:
// - Structured logging (pino or winston)
// - Rate limiting
// - Request ID middleware for tracing
// =============================================================================

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import taskRoutes from './routes/taskRoutes';
import authRoutes from './routes/authRoutes';

// Load environment variables from .env file
// This must happen before anything else that might need env vars
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// -----------------------------------------------------------------------------
// MIDDLEWARE
// -----------------------------------------------------------------------------

// CORS configuration
// In development, our React app runs on port 5173 (Vite default).
// We allow it to talk to our backend. In production you would lock this down.
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Parse JSON bodies
// This middleware makes req.body available as a JavaScript object
app.use(express.json());

// -----------------------------------------------------------------------------
// ROUTES
// -----------------------------------------------------------------------------

// Health check endpoint - useful for Docker, monitoring, and load balancers
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Mount our feature routes
// Note the prefix: all task routes will be under /api/tasks
// This is a common convention that makes the API easier to understand and version later.
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);

// -----------------------------------------------------------------------------
// ERROR HANDLING (Basic)
// -----------------------------------------------------------------------------
// This catches any errors that weren't handled in our routes or middleware.
// A more robust version would have custom error classes and better logging.
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

// -----------------------------------------------------------------------------
// START SERVER
// -----------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
  console.log(`📚 API documentation coming in Phase 3`);
});
