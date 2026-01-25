import { execa, type Options } from 'execa';
import chalk from 'chalk';

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function exec(
  command: string,
  args: string[] = [],
  options: Options = {}
): Promise<ExecResult> {
  try {
    const result = await execa(command, args, {
      ...options,
      reject: false,
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode ?? 0,
    };
  } catch (error: any) {
    return {
      stdout: '',
      stderr: error.message,
      exitCode: 1,
    };
  }
}

export async function execWithOutput(
  command: string,
  args: string[] = [],
  options: Options = {}
): Promise<ExecResult> {
  const result = await execa(command, args, {
    ...options,
    stdio: 'inherit',
    reject: false,
  });

  return {
    stdout: '',
    stderr: '',
    exitCode: result.exitCode ?? 0,
  };
}

export async function checkCommand(command: string): Promise<boolean> {
  const result = await exec('which', [command]);
  return result.exitCode === 0;
}

export async function checkPrerequisites(): Promise<{ valid: boolean; missing: string[] }> {
  const required = ['gcloud', 'terraform', 'docker'];
  const missing: string[] = [];

  for (const cmd of required) {
    const exists = await checkCommand(cmd);
    if (!exists) {
      missing.push(cmd);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

export function log(message: string, type: 'info' | 'warn' | 'error' | 'success' = 'info') {
  const prefix = {
    info: chalk.blue('[INFO]'),
    warn: chalk.yellow('[WARN]'),
    error: chalk.red('[ERROR]'),
    success: chalk.green('[SUCCESS]'),
  };

  console.log(`${prefix[type]} ${message}`);
}
