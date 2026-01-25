import chalk from 'chalk';
import { prompt } from 'enquirer';
import { exec, log } from '../utils/exec.js';

interface SecretsOptions {
  environment: string;
  list?: boolean;
  set?: string;
  get?: string;
}

const AVAILABLE_SECRETS = [
  'db-password',
  'db-connection-string',
  'jwt-secret',
  'stripe-secret-key',
  'stripe-webhook-secret',
  'openai-api-key',
  'anthropic-api-key',
  'perplexity-api-key',
  'sendgrid-api-key',
  'n8n-password',
  'qdrant-api-key',
];

export async function secrets(options: SecretsOptions) {
  const prefix = `hospitality-saas-${options.environment === 'production' ? 'prod' : 'staging'}`;

  console.log(chalk.cyan(`\n🔐 Secret Manager - ${options.environment}\n`));

  // List secrets
  if (options.list) {
    console.log('Available secrets:\n');
    for (const secret of AVAILABLE_SECRETS) {
      const fullName = `${prefix}-${secret}`;
      const result = await exec('gcloud', ['secrets', 'describe', fullName, '--format=json']);
      const exists = result.exitCode === 0;
      const status = exists ? chalk.green('✓') : chalk.gray('○');
      console.log(`  ${status} ${fullName}`);
    }
    return;
  }

  // Get secret value
  if (options.get) {
    const fullName = `${prefix}-${options.get}`;
    const result = await exec('gcloud', ['secrets', 'versions', 'access', 'latest', `--secret=${fullName}`]);
    if (result.exitCode !== 0) {
      log(`Secret not found: ${fullName}`, 'error');
      process.exit(1);
    }
    console.log(`Value for ${fullName}:`);
    console.log(result.stdout);
    return;
  }

  // Set secret value
  if (options.set) {
    const fullName = `${prefix}-${options.set}`;

    // Check if secret exists
    const checkResult = await exec('gcloud', ['secrets', 'describe', fullName]);
    if (checkResult.exitCode !== 0) {
      log(`Secret does not exist: ${fullName}`, 'error');
      log('Run Terraform first to create the secret structure.', 'error');
      process.exit(1);
    }

    // Prompt for value
    const { value } = await prompt<{ value: string }>({
      type: 'password',
      name: 'value',
      message: `Enter value for ${options.set}:`,
    });

    if (!value) {
      log('No value provided', 'warn');
      return;
    }

    // Add new version
    const result = await exec('bash', ['-c', `echo -n "${value}" | gcloud secrets versions add ${fullName} --data-file=-`]);
    if (result.exitCode !== 0) {
      log(`Failed to update secret: ${result.stderr}`, 'error');
      process.exit(1);
    }

    log(`Secret ${fullName} updated successfully!`, 'success');
    return;
  }

  // Interactive mode - show menu
  const { action } = await prompt<{ action: string }>({
    type: 'select',
    name: 'action',
    message: 'What would you like to do?',
    choices: [
      { name: 'list', message: 'List all secrets' },
      { name: 'set', message: 'Set a secret value' },
      { name: 'get', message: 'Get a secret value' },
    ],
  });

  if (action === 'list') {
    return secrets({ ...options, list: true });
  }

  if (action === 'set' || action === 'get') {
    const { secretName } = await prompt<{ secretName: string }>({
      type: 'select',
      name: 'secretName',
      message: 'Select secret:',
      choices: AVAILABLE_SECRETS.map(s => ({ name: s, message: s })),
    });

    if (action === 'set') {
      return secrets({ ...options, set: secretName });
    } else {
      return secrets({ ...options, get: secretName });
    }
  }
}
