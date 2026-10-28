import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/** Where the pdfplumber script and a Python that can import pdfplumber live. */

let pythonExecutable: string | null = null;

export function resolveScriptPath(): string {
  const candidates = [
    path.resolve(__dirname, '..', '..', '..', 'scripts', 'pdfplumber_parser.py'),
    path.resolve(process.cwd(), 'backend', 'scripts', 'pdfplumber_parser.py'),
    path.resolve(process.cwd(), 'scripts', 'pdfplumber_parser.py'),
  ];

  const found = candidates.find(candidate => fs.existsSync(candidate));
  if (!found) {
    throw new Error(
      'Could not locate pdfplumber_parser.py. Ensure backend/scripts/pdfplumber_parser.py is available at runtime.',
    );
  }

  return found;
}

function getPythonCandidates(): string[] {
  const fromEnv = process.env.PDF_PARSER_PYTHON;
  const backendVenv = path.resolve(process.cwd(), 'backend', '.venv', 'bin', 'python');
  const rootVenv = path.resolve(process.cwd(), '.venv', 'bin', 'python');
  const localVenv = path.resolve(__dirname, '..', '..', '..', '.venv', 'bin', 'python');

  const candidates = [fromEnv, backendVenv, rootVenv, localVenv, 'python3', 'python'].filter(
    (entry): entry is string => Boolean(entry),
  );

  return Array.from(new Set(candidates));
}

export function resolvePythonExecutable(): string {
  if (pythonExecutable) {
    return pythonExecutable;
  }

  for (const candidate of getPythonCandidates()) {
    const versionCheck = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
    if (versionCheck.error || versionCheck.status !== 0) {
      continue;
    }
    const libraryCheck = spawnSync(candidate, ['-c', 'import pdfplumber'], { encoding: 'utf8' });
    if (!libraryCheck.error && libraryCheck.status === 0) {
      pythonExecutable = candidate;
      return candidate;
    }
  }

  throw new Error(
    'Python 3 with pdfplumber is required to parse PDF statements. Install it with "pip install pdfplumber" and ensure python3 is available in PATH.',
  );
}
