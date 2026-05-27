import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { createUnauthenticatedClient, createApiClient } from '../lib/api';
import { saveConfig, clearConfig, getConfig } from '../lib/config';

export function loginCommand() {
  const cmd = new Command('login');
  cmd.description('Login to Nebula Cluster');

  cmd.action(async () => {
    try {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'masterUrl',
          message: 'Nebula URL:',
          default: 'http://localhost:3001',
        },
        {
          type: 'input',
          name: 'email',
          message: 'Email:',
        },
        {
          type: 'password',
          name: 'password',
          message: 'Password:',
        }
      ]);

      const spinner = ora('Logging in...').start();
      const api = createUnauthenticatedClient(answers.masterUrl);
      
      try {
        const response = await api.post('/api/v1/auth/login', {
          email: answers.email,
          password: answers.password,
          clientType: 'cli'
        });

        const { accessToken, organizationId, user } = response.data;

        saveConfig({
          masterUrl: answers.masterUrl,
          accessToken: accessToken,
          organizationId: organizationId,
        });

        spinner.succeed(`Logged in successfully as ${user.name}`);
      } catch (error: any) {
        spinner.fail(`Login failed: ${error.response?.data?.error || error.message}`);
      }
    } catch (err) {
      console.error(err);
    }
  });

  return cmd;
}

export function logoutCommand() {
  const cmd = new Command('logout');
  cmd.description('Logout from Nebula Cluster');

  cmd.action(async () => {
    const config = getConfig();
    if (!config) {
      console.log(chalk.yellow('You are already logged out.'));
      return;
    }

    const spinner = ora('Logging out...').start();
    try {
      const api = createApiClient();
      await api.post('/api/v1/auth/logout');
      clearConfig();
      spinner.succeed('Logged out successfully.');
    } catch (error: any) {
      // Even if server fails, clear local config
      clearConfig();
      spinner.succeed('Logged out locally.');
    }
  });

  return cmd;
}
