"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const client_1 = require("@prisma/client");
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const routes_1 = require("./routes");
const provider_account_routes_1 = require("./routes/provider-account-routes");
dotenv_1.default.config();
const prisma = new client_1.PrismaClient();
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
// Enable CORS for dashboard connection
app.use((0, cors_1.default)({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
}));
app.use(express_1.default.json());
// Initialize WebSockets
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    }
});
// Share socket.io and prisma instances globally or via app.locals
app.locals.prisma = prisma;
app.locals.io = io;
// Initialize Redis & BullMQ
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
console.log(`Connecting to Redis at: ${redisUrl}`);
const redisConnection = new ioredis_1.default(redisUrl, {
    maxRetriesPerRequest: null,
});
const jobQueue = new bullmq_1.Queue('nebula-jobs', {
    connection: redisConnection,
    defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
    }
});
app.locals.jobQueue = jobQueue;
// WebSocket connection handling
io.on('connection', (socket) => {
    console.log(`WebSocket client connected: ${socket.id}`);
    socket.on('disconnect', () => {
        console.log(`WebSocket client disconnected: ${socket.id}`);
    });
});
// Register routes
(0, routes_1.registerRoutes)(app);
(0, provider_account_routes_1.registerProviderRoutes)(app);
// ==========================================
// BACKGROUND SERVICES / DAEMONS
// ==========================================
// Daemon 1: Worker Offline Detector (runs every 10s)
async function startWorkerHealthCheckDaemon() {
    setInterval(async () => {
        try {
            const now = new Date();
            const offlineThreshold = new Date(now.getTime() - 30 * 1000); // 30 seconds ago
            // Find workers that were ONLINE/BUSY/DRAINING but haven't updated in 30s
            const staleWorkers = await prisma.worker.findMany({
                where: {
                    status: { in: ['ONLINE', 'BUSY', 'DRAINING'] },
                    OR: [
                        { lastHeartbeatAt: { lt: offlineThreshold } },
                        { lastHeartbeatAt: null }
                    ]
                }
            });
            for (const worker of staleWorkers) {
                console.log(`Worker health check: Worker "${worker.name}" (${worker.id}) missed heartbeats. Marking OFFLINE.`);
                await prisma.$transaction([
                    // 1. Update worker status to OFFLINE
                    prisma.worker.update({
                        where: { id: worker.id },
                        data: { status: 'OFFLINE', activeJobs: 0 },
                    }),
                    // 2. Add a system log for the worker
                    prisma.workerLog.create({
                        data: {
                            organizationId: worker.organizationId,
                            projectId: worker.projectId,
                            workerId: worker.id,
                            level: 'ERROR',
                            message: `Worker disconnected: last heartbeat was at ${worker.lastHeartbeatAt?.toISOString() || 'never'}`,
                        }
                    }),
                    // 3. Mark all running jobs assigned to this worker as STALE or trigger requeue
                    prisma.job.updateMany({
                        where: {
                            assignedWorkerId: worker.id,
                            status: 'RUNNING',
                        },
                        data: {
                            status: 'STALE',
                            placementJson: JSON.stringify({ error: 'Worker disconnected' }),
                        }
                    })
                ]);
                // Broadcast offline event to dashboard
                io.emit('worker:status_changed', {
                    workerId: worker.id,
                    status: 'OFFLINE',
                    message: `Worker "${worker.name}" went offline (heartbeat timeout).`
                });
            }
        }
        catch (error) {
            console.error('Error in Worker Health Check Daemon:', error);
        }
    }, 10 * 1000);
}
// Daemon 2: Expired Lease Recovery & Requeue (runs every 10s)
async function startLeaseRecoveryDaemon() {
    setInterval(async () => {
        try {
            const now = new Date();
            // Find running jobs whose lease has expired
            const expiredLeaseJobs = await prisma.job.findMany({
                where: {
                    status: 'RUNNING',
                    leaseExpiresAt: { lt: now },
                },
                include: {
                    worker: true,
                }
            });
            for (const job of expiredLeaseJobs) {
                console.log(`Lease Recovery: Job "${job.id}" lease expired. Retrying or marking FAILED.`);
                const attemptsUsed = job.attempts + 1;
                const canRetry = attemptsUsed < job.maxAttempts;
                if (canRetry) {
                    // Requeue the job
                    await prisma.$transaction([
                        prisma.job.update({
                            where: { id: job.id },
                            data: {
                                status: 'RETRYING',
                                attempts: attemptsUsed,
                                assignedWorkerId: null,
                                leaseExpiresAt: null,
                            }
                        }),
                        prisma.jobAttempt.create({
                            data: {
                                jobId: job.id,
                                workerId: job.assignedWorkerId,
                                attemptNumber: attemptsUsed,
                                status: 'FAILED',
                                errorJson: JSON.stringify({ message: 'Job lease expired (worker failure or network issues)' }),
                                completedAt: now,
                                failedAt: now,
                            }
                        }),
                        prisma.jobLog.create({
                            data: {
                                organizationId: job.organizationId,
                                projectId: job.projectId,
                                jobId: job.id,
                                workerId: job.assignedWorkerId,
                                level: 'WARNING',
                                message: `Lease expired. Requeuing job (Attempt ${attemptsUsed}/${job.maxAttempts})`,
                            }
                        })
                    ]);
                    // Push back to BullMQ
                    await jobQueue.add(`job-${job.id}`, { jobId: job.id }, { priority: job.priority });
                    io.emit('job:failed', {
                        jobId: job.id,
                        status: 'RETRYING',
                        message: `Job lease expired. Requeuing task.`
                    });
                }
                else {
                    // Exceeded max attempts, mark as FAILED
                    await prisma.$transaction([
                        prisma.job.update({
                            where: { id: job.id },
                            data: {
                                status: 'FAILED',
                                failedAt: now,
                                errorJson: JSON.stringify({ message: 'Job lease expired. Max retry attempts exceeded.' }),
                            }
                        }),
                        prisma.jobAttempt.create({
                            data: {
                                jobId: job.id,
                                workerId: job.assignedWorkerId,
                                attemptNumber: attemptsUsed,
                                status: 'FAILED',
                                errorJson: JSON.stringify({ message: 'Job lease expired. Max retry attempts exceeded.' }),
                                completedAt: now,
                                failedAt: now,
                            }
                        }),
                        prisma.jobLog.create({
                            data: {
                                organizationId: job.organizationId,
                                projectId: job.projectId,
                                jobId: job.id,
                                workerId: job.assignedWorkerId,
                                level: 'ERROR',
                                message: `Job failed: lease expired and exceeded max attempts of ${job.maxAttempts}.`,
                            }
                        })
                    ]);
                    io.emit('job:failed', {
                        jobId: job.id,
                        status: 'FAILED',
                        message: `Job failed (lease expired, retries exhausted).`
                    });
                }
            }
        }
        catch (error) {
            console.error('Error in Lease Recovery Daemon:', error);
        }
    }, 10 * 1000);
}
// Start daemons and server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`Nebula Control Plane API listening on port ${PORT}`);
    startWorkerHealthCheckDaemon();
    startLeaseRecoveryDaemon();
});
//# sourceMappingURL=index.js.map