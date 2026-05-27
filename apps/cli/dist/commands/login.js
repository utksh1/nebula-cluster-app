"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginCommand = loginCommand;
exports.logoutCommand = logoutCommand;
const commander_1 = require("commander");
const inquirer_1 = __importDefault(require("inquirer"));
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const api_1 = require("../lib/api");
const config_1 = require("../lib/config");
function loginCommand() {
    const cmd = new commander_1.Command('login');
    cmd.description('Login to Nebula Cluster');
    cmd.action(async () => {
        try {
            const answers = await inquirer_1.default.prompt([
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
            const spinner = (0, ora_1.default)('Logging in...').start();
            const api = (0, api_1.createUnauthenticatedClient)(answers.masterUrl);
            try {
                const response = await api.post('/api/v1/auth/login', {
                    email: answers.email,
                    password: answers.password,
                    clientType: 'cli'
                });
                const { accessToken, organizationId, user } = response.data;
                (0, config_1.saveConfig)({
                    masterUrl: answers.masterUrl,
                    accessToken: accessToken,
                    organizationId: organizationId,
                });
                spinner.succeed(`Logged in successfully as ${user.name}`);
            }
            catch (error) {
                spinner.fail(`Login failed: ${error.response?.data?.error || error.message}`);
            }
        }
        catch (err) {
            console.error(err);
        }
    });
    return cmd;
}
function logoutCommand() {
    const cmd = new commander_1.Command('logout');
    cmd.description('Logout from Nebula Cluster');
    cmd.action(async () => {
        const config = (0, config_1.getConfig)();
        if (!config) {
            console.log(chalk_1.default.yellow('You are already logged out.'));
            return;
        }
        const spinner = (0, ora_1.default)('Logging out...').start();
        try {
            const api = (0, api_1.createApiClient)();
            await api.post('/api/v1/auth/logout');
            (0, config_1.clearConfig)();
            spinner.succeed('Logged out successfully.');
        }
        catch (error) {
            // Even if server fails, clear local config
            (0, config_1.clearConfig)();
            spinner.succeed('Logged out locally.');
        }
    });
    return cmd;
}
