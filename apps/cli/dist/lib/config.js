"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = getConfig;
exports.saveConfig = saveConfig;
exports.clearConfig = clearConfig;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const CONFIG_DIR = path_1.default.join(os_1.default.homedir(), '.nebula');
const CONFIG_FILE = path_1.default.join(CONFIG_DIR, 'config.json');
function getConfig() {
    if (fs_1.default.existsSync(CONFIG_FILE)) {
        try {
            const data = fs_1.default.readFileSync(CONFIG_FILE, 'utf8');
            return JSON.parse(data);
        }
        catch (err) {
            return null;
        }
    }
    return null;
}
function saveConfig(config) {
    if (!fs_1.default.existsSync(CONFIG_DIR)) {
        fs_1.default.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs_1.default.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}
function clearConfig() {
    if (fs_1.default.existsSync(CONFIG_FILE)) {
        fs_1.default.unlinkSync(CONFIG_FILE);
    }
}
