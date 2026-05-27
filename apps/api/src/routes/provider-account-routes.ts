import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { InstallCommandService } from '../services/install-command.service';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'nebula_super_secret_key';

// Reusing AuthRequest interface locally for typing
interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

// Simplified authentication middleware for provider routes
function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token missing' });
  }

  // Handle CLI token checking (fallback) or JWT checking
  if (token.startsWith('nebula_cli_')) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const prisma: PrismaClient = req.app.locals.prisma;
    
    prisma.cliToken.findFirst({
      where: { tokenHash, status: 'ACTIVE' },
      include: { user: true }
    }).then(cliToken => {
      if (!cliToken) {
        return res.status(403).json({ error: 'Invalid or expired CLI token' });
      }
      req.userId = cliToken.userId;
      req.userRole = cliToken.user.role;
      next();
    }).catch(err => res.status(500).json({ error: err.message }));
  } else {
    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) {
        return res.status(403).json({ error: 'Token is invalid or expired' });
      }
      req.userId = user.userId;
      req.userRole = user.userRole;
      next();
    });
  }
}

export function registerProviderRoutes(app: any) {
  const router = Router();
  const prisma: PrismaClient = app.locals.prisma;

  // ==========================================
  // PROVIDER ACCOUNTS
  // ==========================================

  router.post('/provider-accounts', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { provider, accountName, region, credentials, autoSetup, organizationId } = req.body;

      if (!provider || !accountName || !organizationId) {
        return res.status(400).json({ error: 'provider, accountName, and organizationId are required' });
      }

      // Encrypt credentials in real-world, stringify for MVP
      const credentialsEncrypted = credentials ? JSON.stringify(credentials) : '{}';

      const account = await prisma.providerAccount.create({
        data: {
          organizationId,
          provider,
          accountName,
          region,
          credentialsEncrypted,
          createdBy: req.userId!,
          autoSetupEnabled: autoSetup?.enabled || false,
          defaultWorkerCount: autoSetup?.workerCount || 1,
          defaultWorkerPoolId: autoSetup?.workerPoolId || null,
          status: 'CONNECTED',
        }
      });

      // Log the action
      await prisma.auditLog.create({
        data: {
          organizationId,
          actorUserId: req.userId,
          action: 'provider_account.created',
          targetType: 'provider_account',
          targetId: account.id,
        }
      });

      // Simple implementation of FULL_AUTO setup for MVP - just returns SETUP_PENDING
      let deploymentId = null;
      let status = 'CONNECTED';
      if (autoSetup?.enabled) {
        status = 'SETUP_PENDING';
        
        const deployment = await prisma.providerDeployment.create({
          data: {
            organizationId,
            providerAccountId: account.id,
            setupMode: autoSetup?.setupMode || 'FULL_AUTO',
            workerCount: autoSetup?.workerCount || 1,
            expectedWorkers: autoSetup?.workerCount || 1,
            status: 'PENDING'
          }
        });
        deploymentId = deployment.id;

        // Update account status
        await prisma.providerAccount.update({
          where: { id: account.id },
          data: { status: 'SETUP_PENDING' }
        });
      }

      return res.status(201).json({
        providerAccountId: account.id,
        status: status,
        setupMode: autoSetup?.setupMode || 'MANUAL',
        deploymentId
      });
    } catch (error: any) {
      console.error('Create provider account error:', error);
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/provider-accounts', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { organizationId } = req.query;
      const filter: any = {};
      if (organizationId) {
        filter.organizationId = organizationId;
      }
      
      const accounts = await prisma.providerAccount.findMany({
        where: filter,
        select: {
          id: true,
          organizationId: true,
          provider: true,
          accountName: true,
          region: true,
          status: true,
          autoSetupEnabled: true,
          createdAt: true,
        } // exclude encrypted credentials
      });
      return res.json(accounts);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/provider-accounts/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const account = await prisma.providerAccount.findUnique({
        where: { id: req.params.id },
        select: {
          id: true,
          organizationId: true,
          provider: true,
          accountName: true,
          region: true,
          status: true,
          autoSetupEnabled: true,
          defaultWorkerPoolId: true,
          defaultWorkerCount: true,
          createdAt: true,
        }
      });
      
      if (!account) {
        return res.status(404).json({ error: 'Provider account not found' });
      }
      
      return res.json(account);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  // ==========================================
  // WORKER SETUP
  // ==========================================

  router.post('/provider-accounts/:id/worker-token', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const accountId = req.params.id;
      const { workerPoolId, expiresInDays, maxUses } = req.body;

      const account = await prisma.providerAccount.findUnique({
        where: { id: accountId }
      });

      if (!account) {
        return res.status(404).json({ error: 'Provider account not found' });
      }

      // Generate a secure token
      const token = 'nebula_worker_' + crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      let expiresAt = null;
      if (expiresInDays) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);
      }

      await prisma.workerToken.create({
        data: {
          organizationId: account.organizationId,
          projectId: account.projectId,
          providerAccountId: account.id,
          workerPoolId,
          tokenHash,
          maxUses: maxUses || 1,
          expiresAt,
          createdBy: req.userId
        }
      });

      // Generate install command
      const masterUrl = process.env.NEBULA_MASTER_URL || 'https://nebula.example.com';
      const installCommand = InstallCommandService.generateDockerCommand({
        masterUrl,
        workerToken: token,
        provider: account.provider,
        providerAccountId: account.id,
        workerPoolId,
      });

      await prisma.auditLog.create({
        data: {
          organizationId: account.organizationId,
          actorUserId: req.userId,
          action: 'worker_token.created',
          targetType: 'provider_account',
          targetId: account.id,
        }
      });

      // Return the raw token only once
      return res.json({
        workerToken: token,
        installCommand
      });
    } catch (error: any) {
      console.error('Generate worker token error:', error);
      return res.status(500).json({ error: error.message });
    }
  });
  
  router.post('/provider-accounts/:id/setup-worker', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const accountId = req.params.id;
      const { workerCount, workerPoolId, region, cpu, memory, setupMode } = req.body;

      const account = await prisma.providerAccount.findUnique({
        where: { id: accountId }
      });

      if (!account) {
        return res.status(404).json({ error: 'Provider account not found' });
      }

      const deployment = await prisma.providerDeployment.create({
        data: {
          organizationId: account.organizationId,
          projectId: account.projectId,
          providerAccountId: account.id,
          workerCount: workerCount || 1,
          expectedWorkers: workerCount || 1,
          region,
          cpu,
          memory,
          setupMode: setupMode || 'FULL_AUTO',
          status: 'PENDING'
        }
      });

      return res.status(201).json({
        deploymentId: deployment.id,
        status: deployment.status,
        expectedWorkers: deployment.expectedWorkers
      });
    } catch (error: any) {
      console.error('Setup worker error:', error);
      return res.status(500).json({ error: error.message });
    }
  });

  app.use('/api/v1', router);
}
