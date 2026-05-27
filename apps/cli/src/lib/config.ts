import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.nebula');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export interface NebulaConfig {
  masterUrl: string;
  accessToken: string;
  organizationId: string;
  defaultProjectId?: string;
}

export function getConfig(): NebulaConfig | null {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(data);
    } catch (err) {
      return null;
    }
  }
  return null;
}

export function saveConfig(config: NebulaConfig) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function clearConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    fs.unlinkSync(CONFIG_FILE);
  }
}
