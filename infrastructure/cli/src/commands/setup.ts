import chalk from 'chalk';
import { Listr } from 'listr2';
import { exec, log } from '../utils/exec.js';
import { prompt } from 'enquirer';

interface SetupOptions {
  project?: string;
  billing?: string;
  region?: string;
}

export async function setup(options: SetupOptions) {
  console.log(chalk.cyan('\n🔧 GCP Project Setup\n'));

  // Get project ID
  let projectId = options.project;
  if (!projectId) {
    const response = await prompt<{ projectId: string }>({
      type: 'input',
      name: 'projectId',
      message: 'GCP Project ID:',
      validate: (v) => v.length > 0 || 'Required',
    });
    projectId = response.projectId;
  }

  const region = options.region || 'us-central1';

  const tasks = new Listr([
    {
      title: 'Check/Create GCP project',
      task: async () => {
        const result = await exec('gcloud', ['projects', 'describe', projectId!]);
        if (result.exitCode !== 0) {
          await exec('gcloud', ['projects', 'create', projectId!, '--name=Hospitality SaaS']);
        }
        await exec('gcloud', ['config', 'set', 'project', projectId!]);
      },
    },
    {
      title: 'Link billing account',
      skip: () => !options.billing,
      task: async () => {
        await exec('gcloud', ['billing', 'projects', 'link', projectId!, `--billing-account=${options.billing}`]);
      },
    },
    {
      title: 'Enable required APIs',
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
          'cloudbuild.googleapis.com',
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
        const saEmail = `${saName}@${projectId}.iam.gserviceaccount.com`;

        const result = await exec('gcloud', ['iam', 'service-accounts', 'describe', saEmail]);
        if (result.exitCode !== 0) {
          await exec('gcloud', ['iam', 'service-accounts', 'create', saName, '--display-name=Terraform Deployer']);
        }

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
            'projects', 'add-iam-policy-binding', projectId!,
            `--member=serviceAccount:${saEmail}`,
            `--role=${role}`,
            '--quiet',
          ]);
        }
      },
    },
    {
      title: 'Create Terraform state bucket',
      task: async () => {
        const bucket = `${projectId}-terraform-state`;
        const result = await exec('gsutil', ['ls', `gs://${bucket}`]);
        if (result.exitCode !== 0) {
          await exec('gsutil', ['mb', '-l', region, `gs://${bucket}`]);
          await exec('gsutil', ['versioning', 'set', 'on', `gs://${bucket}`]);
        }
      },
    },
  ], { concurrent: false });

  try {
    await tasks.run();

    console.log(chalk.green(`
╔═══════════════════════════════════════════════════════════════╗
║                    Setup Complete!                             ║
╚═══════════════════════════════════════════════════════════════╝

  Project: ${projectId}
  Region:  ${region}

  Next Steps:
  1. Create service account key (for CI/CD):
     gcloud iam service-accounts keys create key.json \\
       --iam-account=terraform-deployer@${projectId}.iam.gserviceaccount.com

  2. Run full deployment:
     hsp deploy -p ${projectId} -e staging

  3. Or configure Terraform manually and apply.
`));
  } catch (error: any) {
    log(`Setup failed: ${error.message}`, 'error');
    process.exit(1);
  }
}
