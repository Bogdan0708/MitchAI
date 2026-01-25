import { prompt } from 'enquirer';
import chalk from 'chalk';

export interface DeployConfig {
  projectId: string;
  region: string;
  zone: string;
  environment: 'staging' | 'production';
  billingAccount?: string;
  dbTier: string;
  minInstances: number;
  domain?: string;
  stripeKey?: string;
  openaiKey?: string;
  anthropicKey?: string;
  sendgridKey?: string;
}

export async function promptDeployConfig(defaults: Partial<DeployConfig> = {}): Promise<DeployConfig> {
  console.log(chalk.cyan('\n📝 Configuration\n'));

  const answers = await prompt<DeployConfig>([
    {
      type: 'input',
      name: 'projectId',
      message: 'GCP Project ID:',
      initial: defaults.projectId || '',
      validate: (value) => value.length > 0 || 'Project ID is required',
    },
    {
      type: 'select',
      name: 'region',
      message: 'GCP Region:',
      choices: [
        { name: 'us-central1', message: 'us-central1 (Iowa) - Cheapest' },
        { name: 'us-east1', message: 'us-east1 (South Carolina)' },
        { name: 'us-west1', message: 'us-west1 (Oregon)' },
        { name: 'europe-west1', message: 'europe-west1 (Belgium)' },
        { name: 'asia-east1', message: 'asia-east1 (Taiwan)' },
      ],
      initial: defaults.region ? ['us-central1', 'us-east1', 'us-west1', 'europe-west1', 'asia-east1'].indexOf(defaults.region) : 0,
    },
    {
      type: 'select',
      name: 'environment',
      message: 'Environment:',
      choices: [
        { name: 'staging', message: 'Staging (for testing)' },
        { name: 'production', message: 'Production (live)' },
      ],
      initial: defaults.environment === 'production' ? 1 : 0,
    },
    {
      type: 'input',
      name: 'billingAccount',
      message: 'Billing Account ID (leave empty if already linked):',
      initial: defaults.billingAccount || '',
    },
    {
      type: 'select',
      name: 'dbTier',
      message: 'Database Tier:',
      choices: [
        { name: 'db-f1-micro', message: 'db-f1-micro (~$9/mo) - Good for starting' },
        { name: 'db-g1-small', message: 'db-g1-small (~$25/mo) - Better performance' },
        { name: 'db-custom-1-3840', message: 'db-custom-1-3840 (~$50/mo) - Production ready' },
      ],
      initial: 0,
    },
    {
      type: 'select',
      name: 'minInstances',
      message: 'Cloud Run Minimum Instances:',
      choices: [
        { name: '0', message: '0 (Scale to zero - cheapest, but cold starts)' },
        { name: '1', message: '1 (Always on - instant response, ~$25/mo per service)' },
      ],
      initial: 0,
      result(value) {
        return parseInt(value, 10);
      },
    },
    {
      type: 'input',
      name: 'domain',
      message: 'Custom Domain (optional, press enter to skip):',
      initial: defaults.domain || '',
    },
  ]);

  answers.zone = `${answers.region}-a`;

  return answers;
}

export async function promptSecrets(): Promise<Record<string, string>> {
  console.log(chalk.cyan('\n🔐 API Keys & Secrets\n'));
  console.log(chalk.gray('Press enter to skip any secret (can be added later)\n'));

  const answers = await prompt<Record<string, string>>([
    {
      type: 'password',
      name: 'stripeKey',
      message: 'Stripe Secret Key (sk_...):',
    },
    {
      type: 'password',
      name: 'stripeWebhook',
      message: 'Stripe Webhook Secret (whsec_...):',
    },
    {
      type: 'password',
      name: 'openaiKey',
      message: 'OpenAI API Key (sk-...):',
    },
    {
      type: 'password',
      name: 'anthropicKey',
      message: 'Anthropic API Key (sk-ant-...):',
    },
    {
      type: 'password',
      name: 'sendgridKey',
      message: 'SendGrid API Key (SG....):',
    },
  ]);

  return answers;
}

export async function confirm(message: string, defaultValue = false): Promise<boolean> {
  const { confirmed } = await prompt<{ confirmed: boolean }>({
    type: 'confirm',
    name: 'confirmed',
    message,
    initial: defaultValue,
  });

  return confirmed;
}
