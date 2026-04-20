import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';

const MAX_CONVERT_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const config = {
  api: {
    bodyParser: false,
    responseLimit: '12mb',
  },
};

const sanitizeFileName = (value = '') => {
  let decoded = String(value || 'document');
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Keep the raw header value if it is not valid URI encoding.
  }
  const baseName = path.basename(decoded);
  const normalized = baseName.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-');
  return normalized || 'document';
};

const readRequestBody = async (req) => {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const nextChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += nextChunk.length;
    if (totalBytes > MAX_CONVERT_FILE_SIZE_BYTES) {
      throw new Error('Please choose a file smaller than 10MB.');
    }
    chunks.push(nextChunk);
  }

  return Buffer.concat(chunks);
};

const getPythonCommand = async () => {
  const cwd = process.cwd();
  const candidates = process.platform === 'win32'
    ? [
      path.join(cwd, '.venv', 'Scripts', 'python.exe'),
      'python',
      'py',
    ]
    : [
      path.join(cwd, '.venv', 'bin', 'python'),
      'python3',
      'python',
    ];

  for (const candidate of candidates) {
    if (!candidate.includes(path.sep)) return candidate;
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }

  return candidates[0];
};

const runConversion = async (inputPath) => {
  const pythonCommand = await getPythonCommand();
  const scriptPath = path.join(process.cwd(), 'api', '_lib', 'convert_document.py');
  return new Promise((resolve, reject) => {
    const child = spawn(pythonCommand, [scriptPath, '--input', inputPath], {
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
      },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (stderr.trim()) {
        console.error('[convert] python stderr', stderr.trim());
      }

      if (code !== 0) {
        reject(new Error(`Document converter exited with code ${code}.`));
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error('Document converter returned invalid JSON.'));
      }
    });
  });
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const originalFileName = sanitizeFileName(req.headers['x-file-name']);
  const inputPath = path.join(os.tmpdir(), `${randomUUID()}-${originalFileName}`);

  try {
    const buffer = await readRequestBody(req);
    if (!buffer.length) {
      return res.status(400).json({ error: 'Please choose a file first.' });
    }

    await fs.writeFile(inputPath, buffer);
    const result = await runConversion(inputPath);

    if (result.status === 'success' && result.markdown) {
      return res.status(200).json({
        markdown: result.markdown,
        converter: result.converter,
        attempts: result.attempts || [],
      });
    }

    if (result.status === 'ocr_required') {
      return res.status(422).json({
        error: result.error,
        attempts: result.attempts || [],
        needsOcr: true,
      });
    }

    return res.status(422).json({
      error: result.error || 'Unable to convert this file.',
      attempts: result.attempts || [],
    });
  } catch (error) {
    console.error('[convert] request failed', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unable to convert this file.',
    });
  } finally {
    await fs.unlink(inputPath).catch(() => {});
  }
}
