#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const login_1 = require("./commands/login");
const account_1 = require("./commands/account");
const program = new commander_1.Command();
program
    .name('nebula')
    .description('CLI to interact with Nebula Cluster')
    .version('1.0.0');
program.addCommand((0, login_1.loginCommand)());
program.addCommand((0, login_1.logoutCommand)());
program.addCommand((0, account_1.accountCommand)());
program.parse(process.argv);
