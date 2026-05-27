import axios from 'axios';
import dotenv from 'dotenv';
import { io, Socket } from 'socket.io-client';
import os from 'os';

dotenv.config();

const MASTER_URL = process.env.NEBULA_MASTER_URL || 'http://localhost:3001';
const WORKER_NAME = process.env.NEBULA_WORKER_NAME || 'Local-Worker-Node';
const ADMIN_EMAIL = process.env.NEBULA_ADMIN_EMAIL || 'admin@nebula.local';
const ADMIN_PASSWORD = process.env.NEBULA_ADMIN_PASSWORD || 'password123';
const MAX_CONCURRENT = parseInt(process.env.NEBULA_MAX_CONCURRENT_JOBS || '1', 10);
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || '3000', 10);

const nodeId = `worker-${os.hostname()}-${Math.random().toString(36).substring(2, 7)}`;
let token = '';
let workerId = '';
let projectId = '';
let isPolling = false;
let activeJobsCount = 0;
let socket: Socket | null = null;
const runningJobAborts = new Map<string, () => void>(); // Cancel callback map

const WORKER_TOKEN = process.env.NEBULA_WORKER_TOKEN;
const PROVIDER = process.env.NEBULA_PROVIDER || 'local';
const PROVIDER_ACCOUNT_ID = process.env.NEBULA_PROVIDER_ACCOUNT_ID || '';
const WORKER_POOL_ID = process.env.NEBULA_WORKER_POOL || '';

// Core Startup Sequence
async function start() {
  console.log(`[Worker] Starting Nebula Worker Agent...`);
  console.log(`[Worker] Node ID: ${nodeId}`);
  console.log(`[Worker] Connecting to Master Control Plane at: ${MASTER_URL}`);

  try {
    if (WORKER_TOKEN) {
      console.log(`[Worker] Using provided WORKER_TOKEN for registration.`);
      token = WORKER_TOKEN;
    } else {
      // Legacy behavior: 1. Log in to get token
      console.log(`[Worker] Logging in as ${ADMIN_EMAIL}...`);
      const loginRes = await axios.post(`${MASTER_URL}/api/v1/auth/login`, {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      });

      token = loginRes.data.token;
      console.log(`[Worker] Auth successful. Token acquired.`);

      // 2. Fetch Projects list to register for the default project
      const projectsRes = await axios.get(`${MASTER_URL}/api/v1/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const defaultProject = projectsRes.data.find((p: any) => p.slug === 'default-project') || projectsRes.data[0];
      if (!defaultProject) {
        throw new Error('No projects found in organization. Did you run the database seeder?');
      }

      projectId = defaultProject.id;
      console.log(`[Worker] Target Project: "${defaultProject.name}" (ID: ${projectId})`);
    }

    // 3. Register worker node
    console.log(`[Worker] Registering worker node with control plane...`);
    const registerPayload: any = {
      nodeId,
      name: WORKER_NAME,
      provider: PROVIDER,
      cpuCores: os.cpus().length,
      memoryMb: Math.round(os.totalmem() / (1024 * 1024)),
      maxConcurrentJobs: MAX_CONCURRENT,
      capabilities: {
        supportsDocker: false,
        supportsShell: false,
        supportsHttp: true,
        jobTypes: ['http', 'sleep'],
      },
      tags: [PROVIDER, 'worker'],
      trustLevel: PROVIDER === 'local' ? 'local' : 'semi_trusted',
      workerVersion: '0.1.0',
      protocolVersion: 'v1',
    };

    if (projectId) registerPayload.projectId = projectId;
    if (PROVIDER_ACCOUNT_ID) registerPayload.providerAccountId = PROVIDER_ACCOUNT_ID;
    if (WORKER_POOL_ID) registerPayload.workerPoolId = WORKER_POOL_ID;

    const registerRes = await axios.post(`${MASTER_URL}/api/v1/workers/register`, registerPayload, {
      headers: { Authorization: `Bearer ${token}` }
    });

    workerId = registerRes.data.id;
    console.log(`[Worker] Registered successfully. Internal Worker ID: ${workerId}`);

    // 4. Connect WebSockets for live controls (e.g. cancellation)
    initWebSocket();

    // 5. Start Heartbeat Loop (every 10s)
    startHeartbeatLoop();

    // 6. Start Job Polling Loop (every X seconds)
    startPollingLoop();

  } catch (error: any) {
    console.error(`[Worker] Fatal error during startup:`, error.message);
    console.log(`[Worker] Retrying in 10 seconds...`);
    setTimeout(start, 10000);
  }
}

// Socket.IO Websocket connection
function initWebSocket() {
  console.log(`[Worker] Initializing Socket.IO link...`);
  socket = io(MASTER_URL);

  socket.on('connect', () => {
    console.log(`[Worker] WebSocket link established (ID: ${socket?.id})`);
  });

  // Handle cancel requests targeting this specific worker node
  socket.on(`worker:${workerId}:job:cancel`, (data: { jobId: string }) => {
    console.log(`[Worker] Received cancel request for job: ${data.jobId}`);
    const abortFn = runningJobAborts.get(data.jobId);
    if (abortFn) {
      abortFn();
    }
  });

  socket.on('disconnect', () => {
    console.warn(`[Worker] WebSocket link disconnected. Reconnecting...`);
  });
}

// Heartbeat Loop (every 10s)
function startHeartbeatLoop() {
  setInterval(async () => {
    try {
      // Get real memory usage (percentage)
      const freeMem = os.freemem();
      const totalMem = os.totalmem();
      const memoryUsage = Math.round(((totalMem - freeMem) / totalMem) * 100);

      // Get real CPU usage (calculated based on 1-min load average)
      const loadAvg = os.loadavg()[0];
      const cores = os.cpus().length;
      const cpuUsage = Math.min(100, Math.round((loadAvg / cores) * 100));

      await axios.post(`${MASTER_URL}/api/v1/workers/heartbeat`, {
        workerId,
        status: activeJobsCount >= MAX_CONCURRENT ? 'BUSY' : 'ONLINE',
        cpuUsage,
        memoryUsage,
        activeJobs: activeJobsCount,
        uptimeSec: Math.round(process.uptime()),
      });
    } catch (e: any) {
      console.warn(`[Worker] Failed sending heartbeat: ${e.message}`);
    }
  }, 10 * 1000);
}

// Long Polling Task Loop
function startPollingLoop() {
  setInterval(async () => {
    if (isPolling || activeJobsCount >= MAX_CONCURRENT) {
      return; // Skip if busy or currently processing network call
    }

    isPolling = true;
    try {
      const response = await axios.get(`${MASTER_URL}/api/v1/workers/${workerId}/tasks/next`);

      if (response.status === 200 && response.data) {
        const job = response.data;
        // Launch execute asynchronously so we don't block polling tick
        executeJob(job).catch((err) => {
          console.error(`[Worker] Execution error for job ${job.id}:`, err);
        });
      }
    } catch (error: any) {
      // 204 No Content is standard when no jobs are available
      if (error.response?.status !== 204) {
        console.warn(`[Worker] Error polling task: ${error.message}`);
      }
    } finally {
      isPolling = false;
    }
  }, POLL_INTERVAL);
}

// Job Execution Lifecycle
async function executeJob(job: any) {
  const { id: jobId, type: jobType, payload, lease } = job;
  console.log(`[Worker] >>> Starting Job "${jobId}" [Type: ${jobType}]`);

  activeJobsCount++;
  let leaseTimer: NodeJS.Timeout | null = null;
  let isAborted = false;

  // Abort controller function
  const abort = () => {
    isAborted = true;
    console.log(`[Worker] Job ${jobId} execution aborted.`);
  };
  runningJobAborts.set(jobId, abort);

  // Helper to renew lease periodically (every 15s)
  const startLeaseRenewal = () => {
    leaseTimer = setInterval(async () => {
      try {
        await axios.post(`${MASTER_URL}/api/v1/jobs/${jobId}/lease/renew`, {
          leaseToken: lease.leaseToken,
        });
        console.log(`[Worker] Lease renewed for job ${jobId}`);
      } catch (err: any) {
        console.error(`[Worker] Failed renewing lease for job ${jobId}: ${err.message}`);
      }
    }, 15 * 1000);
  };

  // Helper to write execution log to control plane
  const writeJobLog = async (level: 'INFO' | 'WARNING' | 'ERROR', message: string, metadata?: any) => {
    try {
      await axios.post(`${MASTER_URL}/api/v1/jobs/${jobId}/logs`, {
        level,
        message: `[Worker Node] ${message}`,
        metadata,
        timestamp: new Date().toISOString(),
      });
    } catch (e: any) {
      console.warn(`[Worker] Log ingestion failure: ${e.message}`);
    }
  };

  // Helper to write progress
  const writeJobProgress = async (progress: number, stage?: string, message?: string) => {
    try {
      await axios.post(`${MASTER_URL}/api/v1/jobs/${jobId}/progress`, {
        progress,
        stage,
        message,
      });
    } catch (e: any) {
      console.warn(`[Worker] Progress ingestion failure: ${e.message}`);
    }
  };

  // Start lease renewals
  startLeaseRenewal();

  try {
    await writeJobLog('INFO', `Starting job type ${jobType} on executor...`);
    await writeJobProgress(5, 'initializing', 'Job initialized in executor context');

    let resultPayload: any = {};

    // ==========================================
    // EXECUTORS
    // ==========================================
    if (jobType === 'sleep') {
      const durationSec = payload.durationSec || 5;
      await writeJobLog('INFO', `Executing sleep task for ${durationSec} seconds...`);
      
      // Simulate incremental progress ticks
      const progressSteps = 5;
      for (let i = 1; i <= progressSteps; i++) {
        if (isAborted) throw new Error('Job execution cancelled by user request.');
        
        const tickTime = (durationSec * 1000) / progressSteps;
        await new Promise((resolve) => setTimeout(resolve, tickTime));
        
        const percent = Math.round((i / progressSteps) * 90 + 5);
        await writeJobProgress(percent, 'running', `Execution tick ${i}/${progressSteps}`);
        await writeJobLog('INFO', `Sleep progress: tick ${i}/${progressSteps}`);
      }

      resultPayload = {
        sleptSeconds: durationSec,
        hostNode: os.hostname(),
        platform: os.platform(),
      };

    } else if (jobType === 'http') {
      const url = payload.url || 'https://httpbin.org/get';
      const method = (payload.method || 'GET').toUpperCase();
      await writeJobLog('INFO', `Performing HTTP ${method} request to ${url}...`);
      await writeJobProgress(30, 'network_request', 'Sending http request frame...');

      if (isAborted) throw new Error('Job execution cancelled by user request.');

      const response = await axios({
        url,
        method,
        timeout: 10000,
        headers: {
          'User-Agent': 'Nebula-Worker-Agent/0.1.0'
        }
      });

      await writeJobProgress(80, 'processing_response', 'HTTP Response frames received.');
      await writeJobLog('INFO', `HTTP request finished with status code: ${response.status}`);

      resultPayload = {
        statusCode: response.status,
        headers: response.headers,
        data: typeof response.data === 'object' ? response.data : { text: String(response.data).substring(0, 1000) }
      };
    } else {
      throw new Error(`Unsupported job execution runtime: "${jobType}"`);
    }

    if (isAborted) throw new Error('Job execution cancelled by user request.');

    // Complete Job
    await writeJobProgress(100, 'finished', 'Job completed successfully');
    await axios.post(`${MASTER_URL}/api/v1/jobs/${jobId}/result`, {
      leaseToken: lease.leaseToken,
      status: 'COMPLETED',
      result: resultPayload,
    });
    console.log(`[Worker] <<< Job "${jobId}" COMPLETED.`);

  } catch (error: any) {
    console.error(`[Worker] <<< Job "${jobId}" FAILED:`, error.message);
    try {
      await writeJobLog('ERROR', `Execution failed: ${error.message}`);
      await axios.post(`${MASTER_URL}/api/v1/jobs/${jobId}/result`, {
        leaseToken: lease.leaseToken,
        status: 'FAILED',
        error: {
          message: error.message,
          code: 'EXECUTION_ERROR',
        }
      });
    } catch (e: any) {
      console.warn(`[Worker] Failed reporting result: ${e.message}`);
    }
  } finally {
    // Cleanup timers
    if (leaseTimer) clearInterval(leaseTimer);
    runningJobAborts.delete(jobId);
    activeJobsCount = Math.max(0, activeJobsCount - 1);
  }
}

// Start agent
start();
