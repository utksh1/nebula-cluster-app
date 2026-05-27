import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Create a default user
  const email = 'admin@nebula.local';
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    console.log('Default user already exists. Skipping...');
    return;
  }

  const passwordHash = await bcrypt.hash('password123', 10);
  const user = await prisma.user.create({
    data: {
      email,
      name: 'System Admin',
      passwordHash,
      role: 'OWNER',
      status: 'ACTIVE',
    },
  });
  console.log(`Created default user: ${user.email}`);

  // 2. Create a default organization
  const organization = await prisma.organization.create({
    data: {
      name: 'Utkarsh Workspace',
      slug: 'utkarsh-workspace',
      ownerUserId: user.id,
      plan: 'FREE',
      status: 'ACTIVE',
    },
  });
  console.log(`Created default organization: ${organization.name} (${organization.slug})`);

  // 3. Add user as owner in organization
  await prisma.organizationMember.create({
    data: {
      organizationId: organization.id,
      userId: user.id,
      role: 'OWNER',
    },
  });
  console.log('Linked admin user as organization owner.');

  // 4. Create a default project
  const project = await prisma.project.create({
    data: {
      organizationId: organization.id,
      name: 'Default Project',
      slug: 'default-project',
      description: 'The standard project for executing cluster tasks',
      status: 'ACTIVE',
      createdBy: user.id,
    },
  });
  console.log(`Created default project: ${project.name} (${project.slug})`);

  // 5. Create a default worker pool
  const pool = await prisma.workerPool.create({
    data: {
      organizationId: organization.id,
      projectId: project.id,
      name: 'Default Pool',
      slug: 'default-pool',
      description: 'Default execution pool for normal worker nodes',
      allowedJobTypesJson: JSON.stringify(['http', 'sleep']),
      minTrustLevel: 'semi_trusted',
    },
  });
  console.log(`Created default worker pool: ${pool.name} (${pool.slug})`);

  console.log('Seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
