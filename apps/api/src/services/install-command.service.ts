export class InstallCommandService {
  /**
   * Generates a Docker install command for a Nebula Worker.
   */
  static generateDockerCommand(options: {
    masterUrl: string;
    workerToken: string;
    provider: string;
    providerAccountId: string;
    workerPoolId?: string;
    maxConcurrentJobs?: number;
    workerName?: string;
  }): string {
    const {
      masterUrl,
      workerToken,
      provider,
      providerAccountId,
      workerPoolId,
      maxConcurrentJobs,
      workerName,
    } = options;

    let command = `docker run -d \\
  --name nebula-worker${workerName ? `-${workerName}` : ''} \\
  --restart unless-stopped \\
  -e NEBULA_MASTER_URL=${masterUrl} \\
  -e NEBULA_WORKER_TOKEN=${workerToken} \\
  -e NEBULA_PROVIDER=${provider} \\
  -e NEBULA_PROVIDER_ACCOUNT_ID=${providerAccountId}`;

    if (workerPoolId) {
      command += ` \\\n  -e NEBULA_WORKER_POOL=${workerPoolId}`;
    }

    if (maxConcurrentJobs) {
      command += ` \\\n  -e NEBULA_MAX_CONCURRENT_JOBS=${maxConcurrentJobs}`;
    }

    if (workerName) {
      command += ` \\\n  -e NEBULA_WORKER_NAME=${workerName}`;
    }

    command += ` \\\n  nebula/worker:latest`;

    return command;
  }
}
