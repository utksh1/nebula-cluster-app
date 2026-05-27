import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';

dotenv.config();

const STATE_FILE = path.join(__dirname, '..', '.provision_state.json');
const NEBULA_API_BASE = process.env.NEBULA_API_BASE || 'https://nebula-api-37xs.onrender.com';
const ADMIN_EMAIL = 'admin@nebula.local';
const ADMIN_PASSWORD = 'password123';

const app = express();
app.use(cors());
app.use(express.json());

interface ProvisionState {
  lastSequence: number;
}

function getNextEmail(): string {
  let seq = 0;
  if (fs.existsSync(STATE_FILE)) {
    const raw = fs.readFileSync(STATE_FILE, 'utf-8');
    try {
      const state = JSON.parse(raw) as ProvisionState;
      seq = state.lastSequence + 1;
    } catch (e) {}
  }
  
  // Save new state
  fs.writeFileSync(STATE_FILE, JSON.stringify({ lastSequence: seq }, null, 2));

  // Format with leading zeros: 0001, 0002, etc.
  const seqStr = seq.toString().padStart(4, '0');
  return `slave${seqStr}@utksh.in`;
}

async function getNebulaToken(): Promise<string> {
  try {
    const res = await axios.post(`${NEBULA_API_BASE}/api/v1/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    return res.data.token;
  } catch (err: any) {
    throw new Error(`Failed to authenticate with Nebula API: ${err.response?.data?.error || err.message}`);
  }
}

async function fetchNebulaOrgId(token: string): Promise<string> {
  try {
    const res = await axios.get(`${NEBULA_API_BASE}/api/v1/projects`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const project = res.data[0];
    if (!project) throw new Error('No project found in Nebula');
    return project.organizationId;
  } catch (err: any) {
    throw new Error(`Failed to fetch org ID: ${err.response?.data?.error || err.message}`);
  }
}

async function linkProviderToNebula(token: string, orgId: string, email: string, apiKey: string) {
  try {
    await axios.post(`${NEBULA_API_BASE}/api/v1/provider-accounts`, {
      organizationId: orgId,
      provider: 'render',
      accountName: `Auto Render - ${email}`,
      credentials: { apiKey },
      region: 'oregon',
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch (err: any) {
    throw new Error(`Failed to link provider account: ${err.response?.data?.error || err.message}`);
  }
}

let isProvisioning = false;

app.post('/api/provision', async (req, res) => {
  if (isProvisioning) {
    return res.status(400).json({ error: 'A provisioning session is already in progress.' });
  }

  isProvisioning = true;
  
  // Return early to the UI, process in background
  res.json({ message: 'Provisioning started. Check your local machine screen!' });

  try {
    console.log('Starting Auto-Provisioning Script via UI trigger...');

    const token = await getNebulaToken();
    const orgId = await fetchNebulaOrgId(token);
    
    const targetEmail = getNextEmail();
    const targetPassword = 'Ankitsin@1983';

    console.log(`=========================================`);
    console.log(`Target Email:    ${targetEmail}`);
    console.log(`Target Password: ${targetPassword}`);
    console.log(`=========================================`);

    // Launch visible browser (incognito context)
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      console.log('Navigating to Render Registration...');
      await page.goto('https://dashboard.render.com/register');

      console.log('Filling registration form...');
      await page.waitForSelector('input[name="firstName"], input[name="name"]', { state: 'visible' });
      
      const hasFirstName = await page.$('input[name="firstName"]');
      if (hasFirstName) {
        await page.fill('input[name="firstName"]', 'Nebula');
        await page.fill('input[name="lastName"]', 'Worker');
      } else {
        await page.fill('input[name="name"]', 'Nebula Worker');
      }

      await page.fill('input[name="email"]', targetEmail);
      await page.fill('input[name="password"]', targetPassword);

      console.log('\n==========================================================');
      console.log('🛑 ACTION REQUIRED: Please solve the CAPTCHA (if any) and click "Create Account"');
      console.log('Wait for the "Check your email" screen to appear.');
      console.log('==========================================================\n');

      await page.waitForURL(/.*(confirm-email|dashboard|onboarding).*/, { timeout: 0 });

      console.log('\n==========================================================');
      console.log('🛑 ACTION REQUIRED: Please confirm your email address.');
      console.log('Waiting for you to reach the Render Dashboard...');
      console.log('==========================================================\n');

      await page.waitForURL('https://dashboard.render.com/', { timeout: 0 });
      console.log('Detected successful login to Dashboard!');

      console.log('Navigating to API Keys section...');
      await page.goto('https://dashboard.render.com/account/api-keys');

      console.log('Creating new API Key...');
      await page.waitForSelector('text="Create API Key"', { state: 'visible' });
      await page.click('text="Create API Key"');

      await page.waitForSelector('input[placeholder="Key Name"]', { state: 'visible' });
      await page.fill('input[placeholder="Key Name"]', 'Nebula Cluster Auto');
      await page.click('button:has-text("Create Key")');

      console.log('Waiting for API Key to be generated...');
      await page.waitForSelector('.mono', { state: 'visible' }); 

      const apiKeyElement = await page.$('.mono'); 
      let apiKey = '';
      if (apiKeyElement) {
          apiKey = await apiKeyElement.innerText();
      }

      if (apiKey && apiKey.startsWith('rnd_')) {
        console.log(`Successfully extracted API Key: ${apiKey.substring(0, 8)}...`);
        await linkProviderToNebula(token, orgId, targetEmail, apiKey);
        console.log('✅ Node provisioning and linking complete!');
      } else {
         console.log('🛑 ACTION REQUIRED: Could not auto-extract API key. Please copy it manually.');
         await new Promise(r => setTimeout(r, 60000));
      }

    } finally {
      console.log('Closing browser...');
      await browser.close();
    }
  } catch (error) {
    console.error('An error occurred during automation:', error);
  } finally {
    isProvisioning = false;
  }
});

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`✅ Auto-Provisioner Daemon running on http://localhost:${PORT}`);
  console.log(`Waiting for UI triggers...`);
});
