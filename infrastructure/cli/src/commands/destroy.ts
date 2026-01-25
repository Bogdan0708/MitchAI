import chalk from 'chalk';
import { Listr } from 'listr2';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { exec, log } from '../utils/exec.js';
import { confirm } from '../utils/prompts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TERRAFORM_DIR = join(__dirname, '..', '..', '..', 'terraform');

interface DestroyOptions {
  environment: string;
  yes?: boolean;
}

export async function destroy(options: DestroyOptions) {
  const prefix = `hospitality-saas-${options.environment === 'production' ? 'prod' : 'staging'}`;

  console.log(chalk.red(`
╔═══════════════════════════════════════════════════════════════╗
║                         WARNING                                ║
║                                                               ║
║  This will PERMANENTLY DELETE all infrastructure for          ║
║  ${options.environment.padEnd(52)}║
║                                                               ║
║  Including:                                                   ║
║  - Cloud SQL database (ALL DATA WILL BE LOST)                 ║
║  - Cloud Run services                                         ║
║  - Compute Engine VM (n8n + Redis)                            ║
║  - VPC and networking                                         ║
║  - Artifact Registry                                          ║
║  - Secret Manager secrets                                     ║
║                                                               ║
║  This action CANNOT be undone!                                ║
╚═══════════════════════════════════════════════════════════════╝
`));

  if (!options.yes) {
    const confirmed = await confirm(
      `Type "destroy ${options.environment}" to confirm:`,
      false
    );

    if (!confirmed) {
      log('Destroy cancelled', 'info');
      return;
    }

    // Double confirm for production
    if (options.environment === 'production') {
      const doubleConfirm = await confirm(
        'Are you ABSOLUTELY sure? This is PRODUCTION!',
        false
      );
      if (!doubleConfirm) {
        log('Destroy cancelled', 'info');
        return;
      }
    }
  }

  const tasks = new Listr([
    {
      title: 'Disable Cloud SQL deletion protection',
      task: async () => {
        // Find Cloud SQL instance
        const result = await exec('gcloud', [
          'sql', 'instances', 'list',
          `--filter=name~${prefix}`,
          '--format=value(name)',
        ]);

        if (result.stdout.trim()) {
          const instances = result.stdout.trim().split('\n');
          for (const instance of instances) {
            await exec('gcloud', [
              'sql', 'instances', 'patch', instance,
              '--no-deletion-protection',
              '--quiet',
            ]);
          }
        }
      },
    },
    {
      title: 'Run Terraform destroy',
      task: async () => {
        const result = await exec('terraform', [
          'destroy',
          '-auto-approve',
          `-var=environment=${options.environment}`,
        ], { cwd: TERRAFORM_DIR });

        if (result.exitCode !== 0) {
          throw new Error(`Terraform destroy failed: ${result.stderr}`);
        }
      },
    },
    {
      title: 'Clean up orphaned resources',
      task: async (ctx, task) => {
        return task.newListr([
          {
            title: 'Delete Cloud Run services',
            task: async () => {
              const services = [`${prefix}-api`, `${prefix}-frontend`];
              for (const service of services) {
                await exec('gcloud', [
                  'run', 'services', 'delete', service,
                  '--region=us-central1',
                  '--quiet',
                ]);
              }
            },
          },
          {
            title: 'Delete Artifact Registry images',
            task: async () => {
              await exec('gcloud', [
                'artifacts', 'docker', 'images', 'delete',
                `us-central1-docker.pkg.dev/${await getProjectId()}/${prefix}-docker/api`,
                '--delete-tags',
                '--quiet',
              ]);
              await exec('gcloud', [
                'artifacts', 'docker', 'images', 'delete',
                `us-central1-docker.pkg.dev/${await getProjectId()}/${prefix}-docker/frontend`,
                '--delete-tags',
                '--quiet',
              ]);
            },
          },
        ], { concurrent: true, exitOnError: false });
      },
    },
  ], { concurrent: false });

  try {
    await tasks.run();

    console.log(chalk.green(`
╔═══════════════════════════════════════════════════════════════╗
║                    Destroy Complete                            ║
╚═══════════════════════════════════════════════════════════════╝

  All ${options.environment} infrastructure has been destroyed.

  Note: Some resources may take a few minutes to fully delete.
  - Cloud SQL backups are retained for 7 days
  - Audit logs are retained per your retention policy
`));

  } catch (error: any) {
    log(`Destroy failed: ${error.message}`, 'error');
    log('Some resources may need manual cleanup.', 'warn');
    process.exit(1);
  }
}

async function getProjectId(): Promise<string> {
  const result = await exec('gcloud', ['config', 'get-value', 'project']);
  return result.stdout.trim();
}
