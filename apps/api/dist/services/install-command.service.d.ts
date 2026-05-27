export declare class InstallCommandService {
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
    }): string;
}
