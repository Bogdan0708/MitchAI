import chalk from 'chalk';
import { exec, log } from '../utils/exec.js';

interface StatusOptions {
  environment: string;
}

export async function status(options: StatusOptions) {
  const prefix = `hospitality-saas-${options.environment === 'production' ? 'prod' : 'staging'}`;

  console.log(chalk.cyan(`\n📊 Deployment Status - ${options.environment}\n`));

  // Get project ID
  const projectResult = await exec('gcloud', ['config', 'get-value', 'project']);
  const projectId = projectResult.stdout.trim();

  if (!projectId) {
    log('No GCP project configured. Run: gcloud config set project <PROJECT_ID>', 'error');
    process.exit(1);
  }

  console.log(`Project: ${chalk.cyan(projectId)}\n`);

  // Check Cloud Run services
  console.log(chalk.yellow('Cloud Run Services:'));

  const services = [`${prefix}-api`, `${prefix}-frontend`];
  for (const service of services) {
    const result = await exec('gcloud', [
      'run', 'services', 'describe', service,
      '--region=us-central1',
      '--format=json',
    ]);

    if (result.exitCode === 0) {
      const data = JSON.parse(result.stdout);
      const url = data.status?.url || 'N/A';
      const ready = data.status?.conditions?.find((c: any) => c.type === 'Ready')?.status === 'True';
      const status = ready ? chalk.green('●') : chalk.red('●');
      console.log(`  ${status} ${service}`);
      console.log(`    URL: ${url}`);

      // Health check
      if (service.includes('api') && url !== 'N/A') {
        const healthResult = await exec('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', `${url}/api/v1/health`]);
        const healthStatus = healthResult.stdout === '200' ? chalk.green('Healthy') : chalk.red('Unhealthy');
        console.log(`    Health: ${healthStatus}`);
      }
    } else {
      console.log(`  ${chalk.gray('○')} ${service} - Not deployed`);
    }
  }

  // Check Cloud SQL
  console.log(chalk.yellow('\nCloud SQL:'));
  const sqlResult = await exec('gcloud', [
    'sql', 'instances', 'list',
    `--filter=name~${prefix}`,
    '--format=json',
  ]);

  if (sqlResult.exitCode === 0 && sqlResult.stdout !== '[]') {
    const instances = JSON.parse(sqlResult.stdout);
    for (const instance of instances) {
      const status = instance.state === 'RUNNABLE' ? chalk.green('●') : chalk.yellow('●');
      console.log(`  ${status} ${instance.name}`);
      console.log(`    State: ${instance.state}`);
      console.log(`    Tier: ${instance.settings?.tier}`);
      console.log(`    IP: ${instance.ipAddresses?.[0]?.ipAddress || 'N/A'}`);
    }
  } else {
    console.log(`  ${chalk.gray('○')} No Cloud SQL instances found`);
  }

  // Check Compute Engine (n8n VM)
  console.log(chalk.yellow('\nCompute Engine:'));
  const vmResult = await exec('gcloud', [
    'compute', 'instances', 'list',
    `--filter=name~${prefix}-n8n`,
    '--format=json',
  ]);

  if (vmResult.exitCode === 0 && vmResult.stdout !== '[]') {
    const vms = JSON.parse(vmResult.stdout);
    for (const vm of vms) {
      const status = vm.status === 'RUNNING' ? chalk.green('●') : chalk.yellow('●');
      console.log(`  ${status} ${vm.name}`);
      console.log(`    Status: ${vm.status}`);
      console.log(`    Zone: ${vm.zone?.split('/').pop()}`);
      console.log(`    External IP: ${vm.networkInterfaces?.[0]?.accessConfigs?.[0]?.natIP || 'N/A'}`);
      const externalIp = vm.networkInterfaces?.[0]?.accessConfigs?.[0]?.natIP;
      if (externalIp) {
        console.log(`    n8n URL: http://${externalIp}:5678`);
      }
    }
  } else {
    console.log(`  ${chalk.gray('○')} No n8n VM found`);
  }

  // Check Artifact Registry
  console.log(chalk.yellow('\nArtifact Registry:'));
  const repoResult = await exec('gcloud', [
    'artifacts', 'repositories', 'list',
    `--filter=name~${prefix}`,
    '--format=json',
  ]);

  if (repoResult.exitCode === 0 && repoResult.stdout !== '[]') {
    const repos = JSON.parse(repoResult.stdout);
    for (const repo of repos) {
      console.log(`  ${chalk.green('●')} ${repo.name?.split('/').pop()}`);
    }
  } else {
    console.log(`  ${chalk.gray('○')} No repositories found`);
  }

  // Cost estimate
  console.log(chalk.yellow('\nEstimated Monthly Cost:'));
  console.log('  Cloud SQL (micro):      ~$9');
  console.log('  Compute Engine (small): ~$13');
  console.log('  VPC Connector:          ~$12');
  console.log('  Cloud Run:              Variable');
  console.log(chalk.cyan('  Total:                  ~$35-75'));

  console.log('');
}
