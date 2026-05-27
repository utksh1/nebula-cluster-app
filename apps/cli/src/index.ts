#!/usr/bin/env node

import { Command } from 'commander';
import { loginCommand, logoutCommand } from './commands/login';
import { accountCommand } from './commands/account';

const program = new Command();

program
  .name('nebula')
  .description('CLI to interact with Nebula Cluster')
  .version('1.0.0');

program.addCommand(loginCommand());
program.addCommand(logoutCommand());
program.addCommand(accountCommand());

program.parse(process.argv);
