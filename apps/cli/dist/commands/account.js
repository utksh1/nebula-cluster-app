"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountCommand = accountCommand;
const commander_1 = require("commander");
const inquirer_1 = __importDefault(require("inquirer"));
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const api_1 = require("../lib/api");
const config_1 = require("../lib/config");
function accountCommand() {
    const accountCmd = new commander_1.Command('account');
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
            const config = (0, config_1.getConfig)();
            if (!config)
                throw new Error("Not logged in");
            let name = options.name;
            let token = options.token;
            if (!name) {
                const res = await inquirer_1.default.prompt([{ type: 'input', name: 'name', message: 'Account name:' }]);
                name = res.name;
            }
            if (provider !== 'vps' && !token) {
                const res = await inquirer_1.default.prompt([{ type: 'password', name: 'token', message: 'API Token:' }]);
                token = res.token;
            }
            const spinner = (0, ora_1.default)('Adding provider account...').start();
            const api = (0, api_1.createApiClient)();
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
            spinner.succeed(`Provider account created: ${chalk_1.default.green(account.providerAccountId)}`);
            // If manual setup or provider is vps, generate a token and install command
            if (!options.autoSetup || provider === 'vps') {
                spinner.start('Generating worker token and install command...');
                const tokenRes = await api.post(`/api/v1/provider-accounts/${account.providerAccountId}/worker-token`, {
                    workerPoolId: options.workerPool,
                    expiresInDays: 30,
                    maxUses: options.workers || 1
                });
                spinner.succeed('Install command generated successfully:');
                console.log('\n' + chalk_1.default.blue(tokenRes.data.installCommand) + '\n');
            }
        }
        catch (err) {
            console.error(chalk_1.default.red(`\nError: ${err.response?.data?.error || err.message}`));
        }
    });
    accountCmd
        .command('list')
        .description('List provider accounts')
        .action(async () => {
        try {
            const config = (0, config_1.getConfig)();
            if (!config)
                throw new Error("Not logged in");
            const spinner = (0, ora_1.default)('Fetching provider accounts...').start();
            const api = (0, api_1.createApiClient)();
            const res = await api.get(`/api/v1/provider-accounts?organizationId=${config.organizationId}`);
            spinner.stop();
            const accounts = res.data;
            if (accounts.length === 0) {
                console.log(chalk_1.default.yellow('No provider accounts found.'));
                return;
            }
            console.log(chalk_1.default.bold('Provider Accounts:'));
            accounts.forEach((acc) => {
                console.log(`- ${chalk_1.default.green(acc.id)} | ${chalk_1.default.cyan(acc.provider)} | ${acc.accountName} | ${acc.status}`);
            });
        }
        catch (err) {
            console.error(chalk_1.default.red(`\nError: ${err.response?.data?.error || err.message}`));
        }
    });
    return accountCmd;
}
