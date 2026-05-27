"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApiClient = createApiClient;
exports.createUnauthenticatedClient = createUnauthenticatedClient;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("./config");
function createApiClient() {
    const config = (0, config_1.getConfig)();
    if (!config) {
        throw new Error('Not logged in. Please run `nebula login` first.');
    }
    return axios_1.default.create({
        baseURL: config.masterUrl,
        headers: {
            'Authorization': `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json'
        }
    });
}
function createUnauthenticatedClient(masterUrl) {
    return axios_1.default.create({
        baseURL: masterUrl,
        headers: {
            'Content-Type': 'application/json'
        }
    });
}
