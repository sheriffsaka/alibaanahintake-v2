import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    message: 'Standalone debug route works',
    env: process.env.NODE_ENV,
    isVercel: !!process.env.VERCEL,
    time: new Date().toISOString()
  });
}
