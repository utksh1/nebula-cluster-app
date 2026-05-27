import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { createApiClient } from '../lib/api';
import { getConfig } from '../lib/config';

export function accountCommand() {
  const accountCmd = new Command('account');
  accountCmd.description('Manage provider accounts');

  accountCmd
    .command('add <provider>')
    .description('Add a new provider account (e.g. render, vps)')
    .option('--name <name>', 'Account name')
    .option('--token <token>', 'Provider API Token')
    .option('--region <region>', 'Default region')
    .option('--worker-pool <pool>', 'Default worker pool')
    .option('--workers <count>', 'Number of workers', parseInt)
    .option('--auto-setup', 'Automatically setup workers')
    .action(async (provider, options) => {
      try {
        const config = getConfig();
        if (!config) throw new Error("Not logged in");

        let name = options.name;
        let token = options.token;

        if (!name) {
          const res = await inquirer.prompt([{ type: 'input', name: 'name', message: 'Account name:' }]);
          name = res.name;
        }

        if (provider !== 'vps' && !token) {
          const res = await inquirer.prompt([{ type: 'password', name: 'token', message: 'API Token:' }]);
          token = res.token;
        }

        const spinner = ora('Adding provider account...').start();
        const api = createApiClient();
        
        const payload = {
          provider,
          accountName: name,
          organizationId: config.organizationId,
          region: options.region,
          credentials: token ? { apiKey: token } : undefined,
          autoSetup: {
            enabled: !!options.autoSetup,
            workerCount: options.workers || 1,
            workerPoolId: options.workerPool,
            setupMode: provider === 'vps' ? 'MANUAL' : (options.autoSetup ? 'FULL_AUTO' : 'MANUAL')
          }
        };

        const res = await api.post('/api/v1/provider-accounts', payload);
        const account = res.data;
        spinner.succeed(`Provider account created: ${chalk.green(account.providerAccountId)}`);

        // If manual setup or provider is vps, generate a token and install command
        if (!options.autoSetup || provider === 'vps') {
          spinner.start('Generating worker token and install command...');
          const tokenRes = await api.post(`/api/v1/provider-accounts/${account.providerAccountId}/worker-token`, {
            workerPoolId: options.workerPool,
            expiresInDays: 30,
            maxUses: options.workers || 1
          });
          
          spinner.succeed('Install command generated successfully:');
          console.log('\n' + chalk.blue(tokenRes.data.installCommand) + '\n');
        }
      } catch (err: any) {
        console.error(chalk.red(`\nError: ${err.response?.data?.error || err.message}`));
      }
    });

  accountCmd
    .command('list')
    .description('List provider accounts')
    .action(async () => {
      try {
        const config = getConfig();
        if (!config) throw new Error("Not logged in");

        const spinner = ora('Fetching provider accounts...').start();
        const api = createApiClient();
        const res = await api.get(`/api/v1/provider-accounts?organizationId=${config.organizationId}`);
        spinner.stop();

        const accounts = res.data;
        if (accounts.length === 0) {
          console.log(chalk.yellow('No provider accounts found.'));
          return;
        }

        console.log(chalk.bold('Provider Accounts:'));
        accounts.forEach((acc: any) => {
          console.log(`- ${chalk.green(acc.id)} | ${chalk.cyan(acc.provider)} | ${acc.accountName} | ${acc.status}`);
        });
      } catch (err: any) {
        console.error(chalk.red(`\nError: ${err.response?.data?.error || err.message}`));
      }
    });

  return accountCmd;
}
