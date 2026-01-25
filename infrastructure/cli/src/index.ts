#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { deploy } from './commands/deploy.js';
import { setup } from './commands/setup.js';
import { secrets } from './commands/secrets.js';
import { status } from './commands/status.js';
import { destroy } from './commands/destroy.js';

const program = new Command();

console.log(chalk.cyan(`
╔═══════════════════════════════════════════════════════════════╗
║           Hospitality SaaS Deployment CLI                     ║
║                                                               ║
║  Deploy your platform to GCP with a single command            ║
╚═══════════════════════════════════════════════════════════════╝
`));

program
  .name('hsp')
  .description('CLI for deploying Hospitality SaaS to Google Cloud Platform')
  .version('1.0.0');

// Main deploy command - does everything
program
  .command('deploy')
  .description('Full automated deployment (setup + infrastructure + app)')
  .option('-e, --environment <env>', 'Environment (staging/production)', 'staging')
  .option('-p, --project <id>', 'GCP Project ID')
  .option('-r, --region <region>', 'GCP Region', 'us-central1')
  .option('-b, --billing <id>', 'GCP Billing Account ID')
  .option('--skip-setup', 'Skip GCP project setup')
  .option('--skip-infra', 'Skip Terraform infrastructure')
  .option('--skip-secrets', 'Skip secrets configuration')
  .option('--skip-build', 'Skip Docker image builds')
  .option('--skip-migrate', 'Skip database migrations')
  .option('--dry-run', 'Show what would be done without executing')
  .option('-y, --yes', 'Skip confirmation prompts')
  .action(deploy);

// Setup GCP project only
program
  .command('setup')
  .description('Initialize GCP project (APIs, service account, state bucket)')
  .option('-p, --project <id>', 'GCP Project ID')
  .option('-b, --billing <id>', 'GCP Billing Account ID')
  .option('-r, --region <region>', 'GCP Region', 'us-central1')
  .action(setup);

// Manage secrets
program
  .command('secrets')
  .description('Manage Secret Manager secrets')
  .option('-e, --environment <env>', 'Environment (staging/production)', 'staging')
  .option('-l, --list', 'List all secrets')
  .option('-s, --set <name>', 'Set a secret value')
  .option('-g, --get <name>', 'Get a secret value')
  .action(secrets);

// Check deployment status
program
  .command('status')
  .description('Check deployment status and health')
  .option('-e, --environment <env>', 'Environment (staging/production)', 'staging')
  .action(status);

// Destroy infrastructure
program
  .command('destroy')
  .description('Destroy all infrastructure (DANGEROUS)')
  .option('-e, --environment <env>', 'Environment (staging/production)', 'staging')
  .option('-y, --yes', 'Skip confirmation')
  .action(destroy);

program.parse();
