"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRoutes = registerRoutes;
const express_1 = require("express");
const bcrypt = __importStar(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'nebula_super_secret_key';
// Authentication Middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Access token missing' });
    }
    jsonwebtoken_1.default.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token is invalid or expired' });
        }
        req.userId = user.userId;
        req.userRole = user.userRole;
        next();
    });
}
function registerRoutes(app) {
    const router = (0, express_1.Router)();
    const prisma = app.locals.prisma;
    const io = app.locals.io;
    const jobQueue = app.locals.jobQueue;
    // ==========================================
    // AUTHENTICATION
    // ==========================================
    router.post('/auth/login', async (req, res) => {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                return res.status(400).json({ error: 'Email and password are required' });
            }
            const user = await prisma.user.findUnique({
                where: { email },
            });
            if (!user) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
            if (!isPasswordValid) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            const token = jsonwebtoken_1.default.sign({ userId: user.id, userRole: user.role, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
            const membership = await prisma.organizationMember.findFirst({
                where: { userId: user.id },
                include: { organization: true }
            });
            const { clientType } = req.body;
            let accessToken = token; // Default to JWT
            if (clientType === 'cli' && membership) {
                const crypto = require('crypto');
                const cliTokenStr = 'nebula_cli_' + crypto.randomBytes(32).toString('hex');
                const tokenHash = crypto.createHash('sha256').update(cliTokenStr).digest('hex');
                await prisma.cliToken.create({
                    data: {
                        userId: user.id,
                        organizationId: membership.organizationId,
                        tokenHash
                    }
                });
                accessToken = cliTokenStr;
            }
            return res.json({
                token, // legacy/standard JWT
                accessToken, // For CLI compatibility
                organizationId: membership?.organizationId || null,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                },
                organization: membership?.organization || null,
            });
        }
        catch (error) {
            console.error('Login error:', error);
            return res.status(500).json({ error: error.message });
        }
    });
    router.post('/auth/logout', authenticateToken, async (req, res) => {
        try {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            if (token && token.startsWith('nebula_cli_')) {
                const crypto = require('crypto');
                const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
                await prisma.cliToken.updateMany({
                    where: { tokenHash },
                    data: { status: 'REVOKED' }
                });
            }
            return res.json({ success: true });
        }
        catch (error) {
            console.error('Logout error:', error);
            return res.status(500).json({ error: error.message });
        }
    });
    // ==========================================
    // PROJECTS & ORGS
    // ==========================================
    router.get('/projects', authenticateToken, async (req, res) => {
        try {
            const projects = await prisma.project.findMany({
                orderBy: { createdAt: 'desc' }
            });
            return res.json(projects);
        }
        catch (error) {
            return res.status(500).json({ error: error.message });
        }
    });
    router.post('/projects', authenticateToken, async (req, res) => {
        try {
            const { name, slug, description, organizationId } = req.body;
            if (!name || !slug || !organizationId) {
                return res.status(400).json({ error: 'Name, slug, and organizationId are required' });
            }
            const project = await prisma.project.create({
                data: {
                    organizationId,
                    name,
                    slug,
                    description,
                    createdBy: req.userId,
                    status: 'ACTIVE'
                }
            });
            return res.status(201).json(project);
        }
        catch (error) {
            return res.status(500).json({ error: error.message });
        }
    });
    // ==========================================
    // WORKER MANAGEMENT (Worker Node facing)
    // ==========================================
    router.post('/workers/register', async (req, res) => {
        try {
            const payload = req.body;
            const { nodeId, name, provider, projectId, cpuCores, memoryMb, maxConcurrentJobs, capabilities, workerVersion, protocolVersion, trustLevel, tags, } = payload;
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            let organizationId = null;
            let finalProjectId = projectId;
            let finalProviderAccountId = payload.providerAccountId || null;
            let finalWorkerPoolId = payload.workerPoolId || null;
            if (token && token.startsWith('nebula_worker_')) {
                const crypto = require('crypto');
                const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
                const workerToken = await prisma.workerToken.findFirst({
                    where: { tokenHash, status: 'ACTIVE' },
                    include: { providerAccount: true }
                });
                if (!workerToken) {
                    return res.status(403).json({ error: 'Invalid or revoked worker token' });
                }
                if (workerToken.expiresAt && workerToken.expiresAt < new Date()) {
                    return res.status(403).json({ error: 'Worker token expired' });
                }
                if (workerToken.useCount >= workerToken.maxUses) {
                    return res.status(403).json({ error: 'Worker token max uses exceeded' });
                }
                await prisma.workerToken.update({
                    where: { id: workerToken.id },
                    data: {
                        useCount: { increment: 1 },
                        lastUsedAt: new Date()
                    }
                });
                organizationId = workerToken.organizationId;
                finalProjectId = workerToken.projectId || projectId;
                finalProviderAccountId = workerToken.providerAccountId;
                finalWorkerPoolId = workerToken.workerPoolId;
            }
            else {
                if (!nodeId || !name || !provider || !projectId) {
                    return res.status(400).json({ error: 'nodeId, name, provider, and projectId are required' });
                }
                // Legacy/fallback without token (for existing tests etc)
                const project = await prisma.project.findUnique({
                    where: { id: projectId },
                });
                if (!project) {
                    return res.status(404).json({ error: `Project not found: ${projectId}` });
                }
                organizationId = project.organizationId;
            }
            if (!organizationId || !finalProjectId) {
                return res.status(400).json({ error: 'Could not determine organization or project' });
            }
            // Check if worker already exists
            const existingWorker = await prisma.worker.findUnique({
                where: { nodeId },
            });
            let worker;
            if (existingWorker) {
                worker = await prisma.worker.update({
                    where: { nodeId },
                    data: {
                        name,
                        status: 'ONLINE', // Worker registration resets status to ONLINE
                        lastHeartbeatAt: new Date(),
                        cpuCores: cpuCores || existingWorker.cpuCores,
                        memoryMb: memoryMb || existingWorker.memoryMb,
                        maxConcurrentJobs: maxConcurrentJobs || existingWorker.maxConcurrentJobs,
                        capabilitiesJson: JSON.stringify(capabilities || {}),
                        tagsJson: JSON.stringify(tags || []),
                        trustLevel: trustLevel || existingWorker.trustLevel,
                        workerVersion: workerVersion || existingWorker.workerVersion,
                        protocolVersion: protocolVersion || existingWorker.protocolVersion,
                    }
                });
            }
            else {
                worker = await prisma.worker.create({
                    data: {
                        organizationId: organizationId,
                        projectId: finalProjectId,
                        providerAccountId: finalProviderAccountId,
                        workerPoolId: finalWorkerPoolId,
                        nodeId,
                        name,
                        provider,
                        status: 'ONLINE',
                        lastHeartbeatAt: new Date(),
                        cpuCores: cpuCores || 1,
                        memoryMb: memoryMb || 512,
                        maxConcurrentJobs: maxConcurrentJobs || 1,
                        capabilitiesJson: JSON.stringify(capabilities || {}),
                        tagsJson: JSON.stringify(tags || []),
                        trustLevel: trustLevel || 'semi_trusted',
                        workerVersion: workerVersion || '0.1.0',
                        protocolVersion: protocolVersion || 'v1',
                    }
                });
            }
            // Add a registration log
            await prisma.workerLog.create({
                data: {
                    organizationId: worker.organizationId,
                    projectId: worker.projectId,
                    workerId: worker.id,
                    level: 'INFO',
                    message: `Worker agent registered successfully from host (v${worker.workerVersion})`,
                }
            });
            // Broadcast event to dashboard
            io.emit('worker:registered', worker);
            io.emit('worker:status_changed', {
                workerId: worker.id,
                status: 'ONLINE',
                message: `Worker "${worker.name}" registered and is now ONLINE.`
            });
            console.log(`Worker registered successfully: ${worker.name} (${worker.id})`);
            return res.json(worker);
        }
        catch (error) {
            console.error('Worker registration error:', error);
            return res.status(500).json({ error: error.message });
        }
    });
    router.post('/workers/heartbeat', async (req, res) => {
        try {
            const { workerId, status, cpuUsage, memoryUsage, activeJobs, uptimeSec } = req.body;
            if (!workerId) {
                return res.status(400).json({ error: 'workerId is required' });
            }
            const worker = await prisma.worker.findUnique({
                where: { id: workerId }
            });
            if (!worker) {
                return res.status(404).json({ error: 'Worker not registered' });
            }
            const updatedWorker = await prisma.worker.update({
                where: { id: workerId },
                data: {
                    status: status || 'ONLINE',
                    lastHeartbeatAt: new Date(),
                    activeJobs: activeJobs ?? worker.activeJobs,
                }
            });
            // Save metrics in DB
            await prisma.workerHeartbeat.create({
                data: {
                    workerId,
                    cpuUsage: cpuUsage || 0,
                    memoryUsage: memoryUsage || 0,
                    activeJobs: activeJobs || 0,
                    uptimeSec: uptimeSec || 0,
                }
            });
            // Broadcast heartbeat event for live graphs
            io.emit('worker:heartbeat', {
                workerId,
                status: updatedWorker.status,
                cpuUsage: cpuUsage || 0,
                memoryUsage: memoryUsage || 0,
                activeJobs: activeJobs || 0,
                lastHeartbeatAt: updatedWorker.lastHeartbeatAt,
            });
            return res.json({ success: true });
        }
        catch (error) {
            console.error('Worker heartbeat error:', error);
            return res.status(500).json({ error: error.message });
        }
    });
    router.get('/workers', authenticateToken, async (req, res) => {
        try {
            const workers = await prisma.worker.findMany({
                orderBy: { lastHeartbeatAt: 'desc' },
            });
            return res.json(workers);
        }
        catch (error) {
            return res.status(500).json({ error: error.message });
        }
    });
    // ==========================================
    // JOBS (Dashboard / User facing)
    // ==========================================
    router.post('/jobs', authenticateToken, async (req, res) => {
        try {
            const { projectId, type, priority, payload, requirements, retry, maxAttempts, timeoutSec } = req.body;
            if (!projectId || !type || !payload) {
                return res.status(400).json({ error: 'projectId, type, and payload are required' });
            }
            const project = await prisma.project.findUnique({
                where: { id: projectId }
            });
            if (!project) {
                return res.status(404).json({ error: 'Project not found' });
            }
            // Create Job in DB
            const job = await prisma.job.create({
                data: {
                    organizationId: project.organizationId,
                    projectId: project.id,
                    type,
                    priority: priority ?? 0,
                    payloadJson: JSON.stringify(payload),
                    requirementsJson: requirements ? JSON.stringify(requirements) : null,
                    maxAttempts: maxAttempts ?? 3,
                    timeoutSec: timeoutSec ?? 300,
                    status: 'QUEUED',
                    createdBy: req.userId || 'system',
                }
            });
            // Push to BullMQ for scheduling
            await jobQueue.add(`job-${job.id}`, { jobId: job.id }, { priority: job.priority });
            // Create log
            await prisma.jobLog.create({
                data: {
                    organizationId: job.organizationId,
                    projectId: job.projectId,
                    jobId: job.id,
                    workerId: 'system',
                    level: 'INFO',
                    message: `Job submitted to the cluster scheduler queue (Type: ${job.type})`,
                }
            });
            // Broadcast event
            io.emit('job:created', job);
            console.log(`Job created: ${job.id} (Type: ${job.type})`);
            return res.status(201).json(job);
        }
        catch (error) {
            console.error('Job creation error:', error);
            return res.status(500).json({ error: error.message });
        }
    });
    router.get('/jobs', authenticateToken, async (req, res) => {
        try {
            const jobs = await prisma.job.findMany({
                orderBy: { createdAt: 'desc' },
                include: { worker: true }
            });
            return res.json(jobs);
        }
        catch (error) {
            return res.status(500).json({ error: error.message });
        }
    });
    router.get('/jobs/:jobId', authenticateToken, async (req, res) => {
        try {
            const job = await prisma.job.findUnique({
                where: { id: req.params.jobId },
                include: { worker: true, jobAttempts: true }
            });
            if (!job) {
                return res.status(404).json({ error: 'Job not found' });
            }
            return res.json(job);
        }
        catch (error) {
            return res.status(500).json({ error: error.message });
        }
    });
    router.get('/jobs/:jobId/logs', authenticateToken, async (req, res) => {
        try {
            const logs = await prisma.jobLog.findMany({
                where: { jobId: req.params.jobId },
                orderBy: { timestamp: 'asc' }
            });
            return res.json(logs);
        }
        catch (error) {
            return res.status(500).json({ error: error.message });
        }
    });
    router.post('/jobs/:jobId/cancel', authenticateToken, async (req, res) => {
        try {
            const { jobId } = req.params;
            const job = await prisma.job.findUnique({
                where: { id: jobId }
            });
            if (!job) {
                return res.status(404).json({ error: 'Job not found' });
            }
            if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status)) {
                return res.status(400).json({ error: `Cannot cancel job in final state: ${job.status}` });
            }
            // Update state
            const updatedJob = await prisma.job.update({
                where: { id: jobId },
                data: {
                    status: 'CANCELLED',
                    cancelledAt: new Date()
                }
            });
            // Log cancel
            await prisma.jobLog.create({
                data: {
                    organizationId: job.organizationId,
                    projectId: job.projectId,
                    jobId: job.id,
                    workerId: 'system',
                    level: 'WARNING',
                    message: `Job cancelled by user: ${req.userId}`,
                }
            });
            // Broadcast to worker if assigned
            if (job.assignedWorkerId) {
                io.emit(`worker:${job.assignedWorkerId}:job:cancel`, { jobId: job.id });
            }
            io.emit('job:failed', {
                jobId: job.id,
                status: 'CANCELLED',
                message: 'Job cancelled by user request.'
            });
            return res.json(updatedJob);
        }
        catch (error) {
            return res.status(500).json({ error: error.message });
        }
    });
    // ==========================================
    // TASK CONSUMPTION / POLLING (Worker facing)
    // ==========================================
    router.get('/workers/:workerId/tasks/next', async (req, res) => {
        try {
            const { workerId } = req.params;
            const worker = await prisma.worker.findUnique({
                where: { id: workerId }
            });
            if (!worker) {
                return res.status(404).json({ error: 'Worker not found' });
            }
            if (['OFFLINE', 'DISABLED', 'ERROR'].includes(worker.status)) {
                return res.status(400).json({ error: `Worker status must be ONLINE/BUSY to poll. Currently: ${worker.status}` });
            }
            // Read allowed job types from capabilities JSON
            let capabilities = {};
            try {
                capabilities = JSON.parse(worker.capabilitiesJson);
            }
            catch (e) { }
            const allowedJobTypes = capabilities.jobTypes || ['http', 'sleep'];
            // Find the highest priority QUEUED/RETRYING job that matches capabilities and belongs to the project
            const nextJob = await prisma.job.findFirst({
                where: {
                    projectId: worker.projectId,
                    status: { in: ['QUEUED', 'RETRYING'] },
                    type: { in: allowedJobTypes },
                },
                orderBy: [
                    { priority: 'desc' },
                    { queuedAt: 'asc' }
                ]
            });
            if (!nextJob) {
                // Return 204 No Content if no jobs are available
                return res.status(204).end();
            }
            // Generate a lease token
            const leaseToken = `lease_${Math.random().toString(36).substring(2, 15)}`;
            const now = new Date();
            const leaseExpiresAt = new Date(now.getTime() + 30 * 1000); // 30s lease limit
            const updatedJob = await prisma.job.update({
                where: { id: nextJob.id },
                data: {
                    status: 'RUNNING',
                    assignedWorkerId: worker.id,
                    leaseExpiresAt,
                    startedAt: now,
                    attempts: { increment: 1 },
                }
            });
            // Update worker state to BUSY
            await prisma.worker.update({
                where: { id: worker.id },
                data: {
                    status: 'BUSY',
                    activeJobs: { increment: 1 }
                }
            });
            // Create JobLease
            await prisma.jobLease.create({
                data: {
                    jobId: nextJob.id,
                    workerId: worker.id,
                    leaseToken,
                    status: 'ACTIVE',
                    expiresAt: leaseExpiresAt,
                }
            });
            // Create JobAttempt
            await prisma.jobAttempt.create({
                data: {
                    jobId: nextJob.id,
                    workerId: worker.id,
                    attemptNumber: updatedJob.attempts,
                    status: 'RUNNING',
                    startedAt: now,
                }
            });
            // Write execution log
            await prisma.jobLog.create({
                data: {
                    organizationId: nextJob.organizationId,
                    projectId: nextJob.projectId,
                    jobId: nextJob.id,
                    workerId: worker.id,
                    level: 'INFO',
                    message: `Job leased and started on worker node: "${worker.name}" (Attempt ${updatedJob.attempts}/${nextJob.maxAttempts})`,
                }
            });
            // Broadcast start event
            io.emit('job:started', {
                jobId: nextJob.id,
                workerId: worker.id,
                workerName: worker.name,
                status: 'RUNNING',
                attempts: updatedJob.attempts,
            });
            io.emit('worker:status_changed', {
                workerId: worker.id,
                status: 'BUSY',
                message: `Worker "${worker.name}" is now executing job: ${nextJob.id}`
            });
            // Return job details to worker along with lease token
            return res.json({
                id: nextJob.id,
                type: nextJob.type,
                payload: JSON.parse(nextJob.payloadJson),
                maxAttempts: nextJob.maxAttempts,
                timeoutSec: nextJob.timeoutSec,
                lease: {
                    leaseToken,
                    expiresAt: leaseExpiresAt.toISOString()
                }
            });
        }
        catch (error) {
            console.error('Task next polling error:', error);
            return res.status(500).json({ error: error.message });
        }
    });
    router.post('/jobs/:jobId/lease/renew', async (req, res) => {
        try {
            const { jobId } = req.params;
            const { leaseToken } = req.body;
            if (!leaseToken) {
                return res.status(400).json({ error: 'leaseToken is required' });
            }
            const activeLease = await prisma.jobLease.findFirst({
                where: {
                    jobId,
                    leaseToken,
                    status: 'ACTIVE',
                }
            });
            if (!activeLease) {
                return res.status(404).json({ error: 'Active lease not found or invalid token' });
            }
            const now = new Date();
            const expiresAt = new Date(now.getTime() + 30 * 1000); // extend by 30s
            await prisma.$transaction([
                // Extend lease expiry in DB
                prisma.jobLease.update({
                    where: { id: activeLease.id },
                    data: { expiresAt, renewedAt: now }
                }),
                // Extend expiry in job model
                prisma.job.update({
                    where: { id: jobId },
                    data: { leaseExpiresAt: expiresAt }
                })
            ]);
            return res.json({ success: true, expiresAt });
        }
        catch (error) {
            return res.status(500).json({ error: error.message });
        }
    });
    router.post('/jobs/:jobId/progress', async (req, res) => {
        try {
            const { jobId } = req.params;
            const { progress, stage, message } = req.body;
            // Broadcast progress update in real time
            io.emit('job:progress', {
                jobId,
                progress: progress ?? 0,
                stage: stage || '',
                message: message || '',
            });
            return res.json({ success: true });
        }
        catch (error) {
            return res.status(500).json({ error: error.message });
        }
    });
    router.post('/jobs/:jobId/logs', async (req, res) => {
        try {
            const { jobId } = req.params;
            const { level, message, metadata, timestamp } = req.body;
            const job = await prisma.job.findUnique({
                where: { id: jobId }
            });
            if (!job) {
                return res.status(404).json({ error: 'Job not found' });
            }
            const log = await prisma.jobLog.create({
                data: {
                    organizationId: job.organizationId,
                    projectId: job.projectId,
                    jobId,
                    workerId: job.assignedWorkerId || 'unknown',
                    level: level || 'INFO',
                    message: message || '',
                    metadataJson: metadata ? JSON.stringify(metadata) : null,
                    timestamp: timestamp ? new Date(timestamp) : new Date(),
                }
            });
            // Broadcast log update to dashboard listeners
            io.emit('job:log', {
                jobId,
                log: {
                    id: log.id,
                    level: log.level,
                    message: log.message,
                    metadata: metadata || null,
                    timestamp: log.timestamp
                }
            });
            return res.json({ success: true });
        }
        catch (error) {
            return res.status(500).json({ error: error.message });
        }
    });
    router.post('/jobs/:jobId/result', async (req, res) => {
        try {
            const { jobId } = req.params;
            const { leaseToken, status, result, error } = req.body;
            if (!leaseToken || !status) {
                return res.status(400).json({ error: 'leaseToken and status are required' });
            }
            const job = await prisma.job.findUnique({
                where: { id: jobId },
                include: { worker: true }
            });
            if (!job) {
                return res.status(404).json({ error: 'Job not found' });
            }
            // Check active lease
            const lease = await prisma.jobLease.findFirst({
                where: { jobId, leaseToken, status: 'ACTIVE' }
            });
            if (!lease) {
                return res.status(403).json({ error: 'Invalid or expired job lease token' });
            }
            const now = new Date();
            if (status === 'COMPLETED') {
                await prisma.$transaction([
                    // Update job to completed
                    prisma.job.update({
                        where: { id: jobId },
                        data: {
                            status: 'COMPLETED',
                            resultJson: result ? JSON.stringify(result) : null,
                            completedAt: now,
                            leaseExpiresAt: null,
                        }
                    }),
                    // Update active lease to RELEASED
                    prisma.jobLease.update({
                        where: { id: lease.id },
                        data: { status: 'RELEASED', updatedAt: now }
                    }),
                    // Update attempt to completed
                    prisma.jobAttempt.updateMany({
                        where: { jobId, workerId: job.assignedWorkerId, status: 'RUNNING' },
                        data: { status: 'COMPLETED', completedAt: now }
                    }),
                    // Write log
                    prisma.jobLog.create({
                        data: {
                            organizationId: job.organizationId,
                            projectId: job.projectId,
                            jobId,
                            workerId: job.assignedWorkerId,
                            level: 'INFO',
                            message: `Job finished successfully on worker: "${job.worker?.name || 'unknown'}"`,
                        }
                    })
                ]);
                // Broadcast complete event
                io.emit('job:completed', { jobId, result });
            }
            else {
                // FAILED
                await prisma.$transaction([
                    // Update job to failed
                    prisma.job.update({
                        where: { id: jobId },
                        data: {
                            status: 'FAILED',
                            errorJson: error ? JSON.stringify(error) : null,
                            failedAt: now,
                            leaseExpiresAt: null,
                        }
                    }),
                    prisma.jobLease.update({
                        where: { id: lease.id },
                        data: { status: 'RELEASED', updatedAt: now }
                    }),
                    prisma.jobAttempt.updateMany({
                        where: { jobId, workerId: job.assignedWorkerId, status: 'RUNNING' },
                        data: { status: 'FAILED', failedAt: now, errorJson: error ? JSON.stringify(error) : null }
                    }),
                    prisma.jobLog.create({
                        data: {
                            organizationId: job.organizationId,
                            projectId: job.projectId,
                            jobId,
                            workerId: job.assignedWorkerId,
                            level: 'ERROR',
                            message: `Job execution failed on worker: ${error?.message || 'Unknown error'}`,
                        }
                    })
                ]);
                // Broadcast fail event
                io.emit('job:failed', { jobId, error });
            }
            // Free worker capacity
            if (job.assignedWorkerId) {
                const worker = await prisma.worker.findUnique({ where: { id: job.assignedWorkerId } });
                if (worker) {
                    const nextActiveJobs = Math.max(0, worker.activeJobs - 1);
                    await prisma.worker.update({
                        where: { id: job.assignedWorkerId },
                        data: {
                            status: nextActiveJobs > 0 ? 'BUSY' : 'ONLINE',
                            activeJobs: nextActiveJobs,
                        }
                    });
                    io.emit('worker:status_changed', {
                        workerId: worker.id,
                        status: nextActiveJobs > 0 ? 'BUSY' : 'ONLINE',
                        message: `Worker "${worker.name}" released from job ${jobId}.`
                    });
                }
            }
            return res.json({ success: true });
        }
        catch (error) {
            console.error('Job result error:', error);
            return res.status(500).json({ error: error.message });
        }
    });
    // ==========================================
    // PROVIDER ACCOUNTS
    // ==========================================
    router.get('/provider-accounts', authenticateToken, async (req, res) => {
        try {
            const accounts = await prisma.providerAccount.findMany({
                orderBy: { createdAt: 'desc' }
            });
            return res.json(accounts);
        }
        catch (error) {
            return res.status(500).json({ error: error.message });
        }
    });
    router.post('/provider-accounts', authenticateToken, async (req, res) => {
        try {
            const { provider, accountName, credentials, region, organizationId } = req.body;
            if (!provider || !accountName || !credentials || !organizationId) {
                return res.status(400).json({ error: 'provider, accountName, credentials, and organizationId are required' });
            }
            // Simple encryption string representation for MVP
            const credentialsEncrypted = JSON.stringify(credentials);
            const account = await prisma.providerAccount.create({
                data: {
                    organizationId,
                    provider,
                    accountName,
                    credentialsEncrypted,
                    region: region || 'any',
                    status: 'CONNECTED',
                    createdBy: req.userId || 'system',
                }
            });
            return res.status(201).json(account);
        }
        catch (error) {
            return res.status(500).json({ error: error.message });
        }
    });
    router.post('/provider-accounts/link-cli', authenticateToken, async (req, res) => {
        try {
            const { organizationId } = req.body;
            if (!organizationId) {
                return res.status(400).json({ error: 'organizationId is required' });
            }
            const fs = require('fs');
            const path = require('path');
            const os = require('os');
            const configPath = path.join(os.homedir(), '.render', 'cli.yaml');
            if (!fs.existsSync(configPath)) {
                return res.status(404).json({ error: 'Render CLI configuration not found at ~/.render/cli.yaml' });
            }
            const content = fs.readFileSync(configPath, 'utf8');
            const keyMatch = content.match(/key:\s*(rnd_[a-zA-Z0-9_]+)/);
            const nameMatch = content.match(/workspace_name:\s*(.+)/);
            const workspaceMatch = content.match(/workspace:\s*(.+)/);
            if (!keyMatch) {
                return res.status(400).json({ error: 'API Key not found in local Render CLI config file.' });
            }
            const apiKey = keyMatch[1].trim();
            const workspaceName = nameMatch ? nameMatch[1].trim() : 'Render CLI Workspace';
            const workspaceId = workspaceMatch ? workspaceMatch[1].trim() : 'unknown';
            const credentialsEncrypted = JSON.stringify({ apiKey });
            const account = await prisma.providerAccount.create({
                data: {
                    organizationId,
                    provider: 'render',
                    accountName: `Render CLI: ${workspaceName} (${workspaceId})`,
                    credentialsEncrypted,
                    region: 'any',
                    status: 'CONNECTED',
                    createdBy: req.userId || 'system',
                }
            });
            return res.status(201).json(account);
        }
        catch (error) {
            return res.status(500).json({ error: error.message });
        }
    });
    // Register routes under Express app
    app.use('/api/v1', router);
}
//# sourceMappingURL=routes.js.map