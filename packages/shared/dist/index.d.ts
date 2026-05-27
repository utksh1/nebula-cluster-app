export type WorkerStatus = 'ONLINE' | 'OFFLINE' | 'BUSY' | 'ERROR' | 'DRAINING' | 'DISABLED';
export type JobStatus = 'QUEUED' | 'ASSIGNED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'RETRYING' | 'CANCELLING' | 'CANCELLED' | 'TIMEOUT' | 'STALE' | 'DEAD_LETTER';
export interface WorkerCapabilities {
    supportsDocker: boolean;
    supportsShell: boolean;
    supportsHttp: boolean;
    jobTypes: string[];
}
export interface WorkerRegisterPayload {
    nodeId: string;
    name: string;
    provider: string;
    providerAccountId?: string;
    projectId: string;
    workerPoolId?: string;
    region?: string;
    cpuCores: number;
    memoryMb: number;
    maxConcurrentJobs: number;
    capabilities: WorkerCapabilities;
    tags?: string[];
    trustLevel?: string;
    workerVersion: string;
    protocolVersion: string;
}
export interface WorkerHeartbeatPayload {
    workerId: string;
    status: WorkerStatus;
    cpuUsage: number;
    memoryUsage: number;
    networkRx?: number;
    networkTx?: number;
    activeJobs: number;
    uptimeSec: number;
}
export interface JobCreatePayload {
    projectId: string;
    type: string;
    priority?: number;
    payload: any;
    requirements?: {
        cpu?: number;
        memoryMb?: number;
        timeoutSec?: number;
        workerPoolId?: string;
        provider?: string;
        providerAccountId?: string;
        region?: string;
        requiresDocker?: boolean;
        requiresTrustLevel?: string;
    };
    retry?: {
        maxAttempts?: number;
        backoff?: 'exponential' | 'fixed';
    };
    webhookUrl?: string;
}
export interface JobProgressPayload {
    progress: number;
    stage?: string;
    message?: string;
}
export interface JobLogPayload {
    level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
    message: string;
    metadata?: any;
    timestamp?: string;
}
export interface JobResultPayload {
    leaseToken: string;
    status: 'COMPLETED' | 'FAILED';
    result?: any;
    error?: {
        message: string;
        code?: string;
        stack?: string;
    };
    artifacts?: string[];
}
