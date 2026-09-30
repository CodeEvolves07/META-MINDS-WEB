import express from 'express';
import { executeCode } from '../services/judge0Service.js';

const router = express.Router();

// POST /api/judge0/run - Execute code remotely or in sandbox
router.post('/run', async (req, res) => {
  try {
    const { source_code, language, stdin } = req.body;

    if (source_code === undefined || source_code === null) {
      return res.status(400).json({
        success: false,
        message: 'source_code is required'
      });
    }

    const result = await executeCode({
      source_code,
      language: language || 'python',
      stdin: typeof stdin === 'string' ? stdin : ''
    });

    return res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Error executing code:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to execute code: ' + error.message
    });
  }
});

export default router;
