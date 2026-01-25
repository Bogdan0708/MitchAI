import { Listr } from 'listr2';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFile, readFile, access } from 'fs/promises';
import { exec, execWithOutput, checkPrerequisites, log } from '../utils/exec.js';
import { promptDeployConfig, promptSecrets, confirm, type DeployConfig } from '../utils/prompts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..', '..', '..', '..');
const TERRAFORM_DIR = join(__dirname, '..', '..', '..', 'terraform');

interface DeployOptions {
  environment: string;
  project?: string;
  region?: string;
  billing?: string;
  skipSetup?: boolean;
  skipInfra?: boolean;
  skipSecrets?: boolean;
  skipBuild?: boolean;
  skipMigrate?: boolean;
  dryRun?: boolean;
  yes?: boolean;
}

export async function deploy(options: DeployOptions) {
  console.log(chalk.cyan('\n🚀 Starting Deployment\n'));

  // Check prerequisites
  const prereqs = await checkPrerequisites();
  if (!prereqs.valid) {
    log(`Missing required tools: ${prereqs.missing.join(', ')}`, 'error');
    log('Please install them and try again.', 'error');
    process.exit(1);
  }

  // Get configuration (interactive or from options)
  let config: DeployConfig;

  if (options.yes && options.project) {
    // Non-interactive mode
    config = {
      projectId: options.project,
      region: options.region || 'us-central1',
      zone: `${options.region || 'us-central1'}-a`,
      environment: options.environment as 'staging' | 'production',
      billingAccount: options.billing,
      dbTier: 'db-f1-micro',
      minInstances: 0,
    };
  } else {
    // Interactive mode
    config = await promptDeployConfig({
      projectId: options.project,
      region: options.region,
      environment: options.environment as 'staging' | 'production',
      billingAccount: options.billing,
    });
  }

  // Show configuration summary
  console.log(chalk.cyan('\n📋 Configuration Summary\n'));
  console.log(`  Project ID:    ${chalk.green(config.projectId)}`);
  console.log(`  Region:        ${chalk.green(config.region)}`);
  console.log(`  Environment:   ${chalk.green(config.environment)}`);
  console.log(`  DB Tier:       ${chalk.green(config.dbTier)}`);
  console.log(`  Min Instances: ${chalk.green(config.minInstances)}`);
  if (config.domain) {
    console.log(`  Domain:        ${chalk.green(config.domain)}`);
  }
  console.log('');

  // Dry run mode
  if (options.dryRun) {
    log('Dry run mode - showing what would be done:', 'info');
    console.log(chalk.gray(`
  1. Setup GCP project ${config.projectId}
  2. Enable required APIs
  3. Create Terraform variables
  4. Apply Terraform infrastructure
  5. Configure secrets in Secret Manager
  6. Build and push Docker images
  7. Run database migrations
  8. Deploy to Cloud Run
    `));
    return;
  }

  // Confirm deployment
  if (!options.yes) {
    const confirmed = await confirm('Proceed with deployment?', true);
    if (!confirmed) {
      log('Deployment cancelled', 'warn');
      return;
    }
  }

  // Get secrets if not skipping
  let secrets: Record<string, string> = {};
  if (!options.skipSecrets && !options.yes) {
    secrets = await promptSecrets();
  }

  // Create and run task list
  const tasks = new Listr([
    {
      title: 'Setup GCP Project',
      skip: () => options.skipSetup,
      task: async (ctx, task) => {
        return task.newListr([
          {
            title: 'Check/Create project',
            task: async () => {
              const result = await exec('gcloud', ['projects', 'describe', config.projectId]);
              if (result.exitCode !== 0) {
                await exec('gcloud', ['projects', 'create', config.projectId, '--name=Hospitality SaaS']);
              }
              await exec('gcloud', ['config', 'set', 'project', config.projectId]);
            },
          },
          {
            title: 'Link billing account',
            skip: () => !config.billingAccount,
            task: async () => {
              await exec('gcloud', ['billing', 'projects', 'link', config.projectId, `--billing-account=${config.billingAccount}`]);
            },
          },
          {
            title: 'Enable APIs',
            task: async () => {
              const apis = [
                'compute.googleapis.com',
                'sqladmin.googleapis.com',
                'run.googleapis.com',
                'secretmanager.googleapis.com',
                'artifactregistry.googleapis.com',
                'vpcaccess.googleapis.com',
                'servicenetworking.googleapis.com',
                'cloudresourcemanager.googleapis.com',
                'iam.googleapis.com',
              ];
              for (const api of apis) {
                await exec('gcloud', ['services', 'enable', api, '--quiet']);
              }
            },
          },
          {
            title: 'Create service account',
            task: async () => {
              const saName = 'terraform-deployer';
              const saEmail = `${saName}@${config.projectId}.iam.gserviceaccount.com`;

              // Check if exists
              const result = await exec('gcloud', ['iam', 'service-accounts', 'describe', saEmail]);
              if (result.exitCode !== 0) {
                await exec('gcloud', ['iam', 'service-accounts', 'create', saName, '--display-name=Terraform Deployer']);
              }

              // Grant roles
              const roles = [
                'roles/compute.admin',
                'roles/iam.serviceAccountAdmin',
                'roles/iam.serviceAccountUser',
                'roles/resourcemanager.projectIamAdmin',
                'roles/secretmanager.admin',
                'roles/cloudsql.admin',
                'roles/run.admin',
                'roles/artifactregistry.admin',
                'roles/vpcaccess.admin',
                'roles/servicenetworking.networksAdmin',
                'roles/storage.admin',
              ];

              for (const role of roles) {
                await exec('gcloud', [
                  'projects', 'add-iam-policy-binding', config.projectId,
                  `--member=serviceAccount:${saEmail}`,
                  `--role=${role}`,
                  '--quiet',
                ]);
              }
            },
          },
        ], { concurrent: false });
      },
    },
    {
      title: 'Generate Terraform Configuration',
      skip: () => options.skipInfra,
      task: async () => {
        const tfvars = `
project_id  = "${config.projectId}"
region      = "${config.region}"
zone        = "${config.zone}"
environment = "${config.environment}"

db_tier              = "${config.dbTier}"
db_disk_size         = 10
db_name              = "hospitality_db"
db_user              = "hospitality_admin"
db_high_availability = false
db_backup_enabled    = true

api_min_instances = ${config.minInstances}
api_max_instances = 10
frontend_min_instances = ${config.minInstances}
frontend_max_instances = 5

api_cpu      = "1"
api_memory   = "512Mi"
frontend_cpu = "1"
frontend_memory = "256Mi"

n8n_vm_machine_type = "e2-small"
n8n_vm_disk_size    = "20"

${config.domain ? `domain = "${config.domain}"` : '# domain = ""'}

labels = {
  managed-by  = "terraform"
  project     = "hospitality-saas"
  deployed-by = "cli"
}
`;
        await writeFile(join(TERRAFORM_DIR, 'terraform.tfvars'), tfvars);
      },
    },
    {
      title: 'Apply Terraform Infrastructure',
      skip: () => options.skipInfra,
      task: async (ctx, task) => {
        return task.newListr([
          {
            title: 'Initialize Terraform',
            task: async () => {
              await exec('terraform', ['init', '-input=false'], { cwd: TERRAFORM_DIR });
            },
          },
          {
            title: 'Plan changes',
            task: async () => {
              const result = await exec('terraform', ['plan', '-out=tfplan', '-input=false'], { cwd: TERRAFORM_DIR });
              if (result.exitCode !== 0) {
                throw new Error(`Terraform plan failed: ${result.stderr}`);
              }
            },
          },
          {
            title: 'Apply changes',
            task: async () => {
              const result = await exec('terraform', ['apply', '-auto-approve', 'tfplan'], { cwd: TERRAFORM_DIR });
              if (result.exitCode !== 0) {
                throw new Error(`Terraform apply failed: ${result.stderr}`);
              }
            },
          },
        ], { concurrent: false });
      },
    },
    {
      title: 'Configure Secrets',
      skip: () => options.skipSecrets,
      task: async () => {
        const prefix = `hospitality-saas-${config.environment === 'production' ? 'prod' : 'staging'}`;

        const secretMap: Record<string, string> = {
          stripeKey: 'stripe-secret-key',
          stripeWebhook: 'stripe-webhook-secret',
          openaiKey: 'openai-api-key',
          anthropicKey: 'anthropic-api-key',
          sendgridKey: 'sendgrid-api-key',
        };

        for (const [key, secretName] of Object.entries(secretMap)) {
          if (secrets[key]) {
            await exec('gcloud', [
              'secrets', 'versions', 'add', `${prefix}-${secretName}`,
              `--data-file=-`,
            ], { input: secrets[key] });
          }
        }
      },
    },
    {
      title: 'Build Docker Images',
      skip: () => options.skipBuild,
      task: async (ctx, task) => {
        const registry = `${config.region}-docker.pkg.dev`;
        const repo = `${config.projectId}/hospitality-saas-${config.environment === 'production' ? 'prod' : 'staging'}-docker`;

        return task.newListr([
          {
            title: 'Configure Docker authentication',
            task: async () => {
              await exec('gcloud', ['auth', 'configure-docker', registry, '--quiet']);
            },
          },
          {
            title: 'Build API image',
            task: async () => {
              await exec('docker', [
                'build', '-t', `${registry}/${repo}/api:latest`,
                '--target', 'production',
                '.',
              ], { cwd: ROOT_DIR });
            },
          },
          {
            title: 'Push API image',
            task: async () => {
              await exec('docker', ['push', `${registry}/${repo}/api:latest`]);
            },
          },
          {
            title: 'Build Frontend image',
            task: async () => {
              await exec('docker', [
                'build', '-t', `${registry}/${repo}/frontend:latest`,
                '.',
              ], { cwd: join(ROOT_DIR, 'frontend') });
            },
          },
          {
            title: 'Push Frontend image',
            task: async () => {
              await exec('docker', ['push', `${registry}/${repo}/frontend:latest`]);
            },
          },
        ], { concurrent: false });
      },
    },
    {
      title: 'Run Database Migrations',
      skip: () => options.skipMigrate,
      task: async () => {
        // Get connection info from Terraform
        const connResult = await exec('terraform', ['output', '-raw', 'cloud_sql_connection_name'], { cwd: TERRAFORM_DIR });
        if (connResult.exitCode !== 0) {
          throw new Error('Could not get Cloud SQL connection name');
        }
        const connectionName = connResult.stdout.trim();

        const prefix = `hospitality-saas-${config.environment === 'production' ? 'prod' : 'staging'}`;
        const pwResult = await exec('gcloud', ['secrets', 'versions', 'access', 'latest', `--secret=${prefix}-db-password`]);
        const dbPassword = pwResult.stdout.trim();

        // Start Cloud SQL Proxy
        const proxy = exec('cloud-sql-proxy', [connectionName, '--port=5432']);

        // Wait for proxy to start
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Run migrations
        const migrateResult = await exec('npm', ['run', 'db:migrate'], {
          cwd: ROOT_DIR,
          env: {
            ...process.env,
            DATABASE_URL: `postgresql://hospitality_admin:${dbPassword}@localhost:5432/hospitality_db`,
          },
        });

        if (migrateResult.exitCode !== 0) {
          throw new Error(`Migration failed: ${migrateResult.stderr}`);
        }
      },
    },
    {
      title: 'Deploy to Cloud Run',
      task: async (ctx, task) => {
        const prefix = `hospitality-saas-${config.environment === 'production' ? 'prod' : 'staging'}`;
        const registry = `${config.region}-docker.pkg.dev`;
        const repo = `${config.projectId}/hospitality-saas-${config.environment === 'production' ? 'prod' : 'staging'}-docker`;

        return task.newListr([
          {
            title: 'Deploy API',
            task: async () => {
              await exec('gcloud', [
                'run', 'deploy', `${prefix}-api`,
                `--image=${registry}/${repo}/api:latest`,
                `--region=${config.region}`,
                '--platform=managed',
                '--allow-unauthenticated',
                '--port=3000',
                '--quiet',
              ]);
            },
          },
          {
            title: 'Deploy Frontend',
            task: async () => {
              // Get API URL
              const urlResult = await exec('gcloud', [
                'run', 'services', 'describe', `${prefix}-api`,
                `--region=${config.region}`,
                '--format=value(status.url)',
              ]);
              const apiUrl = urlResult.stdout.trim();

              await exec('gcloud', [
                'run', 'deploy', `${prefix}-frontend`,
                `--image=${registry}/${repo}/frontend:latest`,
                `--region=${config.region}`,
                '--platform=managed',
                '--allow-unauthenticated',
                '--port=3000',
                `--set-env-vars=NEXT_PUBLIC_API_URL=${apiUrl}/api/v1`,
                '--quiet',
              ]);
            },
          },
        ], { concurrent: false });
      },
    },
  ], {
    concurrent: false,
    rendererOptions: {
      collapseSubtasks: false,
    },
  });

  try {
    await tasks.run();

    // Get deployment URLs
    const prefix = `hospitality-saas-${config.environment === 'production' ? 'prod' : 'staging'}`;

    const apiUrlResult = await exec('gcloud', [
      'run', 'services', 'describe', `${prefix}-api`,
      `--region=${config.region}`,
      '--format=value(status.url)',
    ]);

    const frontendUrlResult = await exec('gcloud', [
      'run', 'services', 'describe', `${prefix}-frontend`,
      `--region=${config.region}`,
      '--format=value(status.url)',
    ]);

    console.log(chalk.green(`
╔═══════════════════════════════════════════════════════════════╗
║                    Deployment Complete!                        ║
╚═══════════════════════════════════════════════════════════════╝

  Environment: ${config.environment}
  Region:      ${config.region}

  URLs:
  ├─ API:      ${apiUrlResult.stdout.trim()}
  ├─ Frontend: ${frontendUrlResult.stdout.trim()}
  └─ Health:   ${apiUrlResult.stdout.trim()}/api/v1/health

  Next Steps:
  1. Update secrets if not done: hsp secrets -e ${config.environment} -s <secret-name>
  2. Configure custom domain in Cloud Run console
  3. Set up Stripe webhooks pointing to API URL
  4. Access n8n at: terraform output n8n_url
`));

  } catch (error: any) {
    log(`Deployment failed: ${error.message}`, 'error');
    process.exit(1);
  }
}
