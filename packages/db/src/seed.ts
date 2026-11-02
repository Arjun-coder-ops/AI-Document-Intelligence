import crypto from 'node:crypto';
import { hash, Algorithm } from '@node-rs/argon2';
import { eq } from 'drizzle-orm';
import { db } from './client.js';
import { tenants, users, documents, chunks } from './schema/index.js';

export const DEMO_TENANT_ID =
  process.env['DEMO_TENANT_ID'] ?? '00000000-0000-4000-8000-000000000001';

export async function seedDatabase(): Promise<{ tenantId: string; viewerUserId: string }> {
  console.info('Seeding database with read-only demo workspace and viewer account...');

  // 1. Create or retrieve Demo Tenant
  let tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, DEMO_TENANT_ID),
  });

  if (!tenant) {
    const [inserted] = await db
      .insert(tenants)
      .values({
        id: DEMO_TENANT_ID,
        name: 'DocSage Demo Workspace',
      })
      .returning({ id: tenants.id, name: tenants.name, createdAt: tenants.createdAt });

    if (!inserted) throw new Error('Failed to insert demo tenant');
    tenant = inserted;
  }

  // 2. Derive Demo Password from GitHub Secret / Environment Variable
  const demoSecret = process.env['DEMO_PASSWORD'];
  if (!demoSecret && process.env['NODE_ENV'] === 'production') {
    throw new Error(
      'DEMO_PASSWORD environment variable is required to seed the demo account in production.',
    );
  }

  const rawPassword = demoSecret || crypto.randomBytes(16).toString('hex');
  if (!demoSecret) {
    console.warn(
      '[db:seed] DEMO_PASSWORD not set in environment. Generated ephemeral development credential.',
    );
  }

  // Compute fresh Argon2id hash dynamically (memory-hard 64MB, 3 iterations, 4 parallelism threads)
  const passwordHash = await hash(rawPassword, {
    memoryCost: 65536,
    timeCost: 3,
    outputLen: 32,
    parallelism: 4,
    algorithm: Algorithm.Argon2id,
  });

  // 3. Upsert Read-Only Demo Viewer User (no demo admin account seeded)
  let demoUser = await db.query.users.findFirst({
    where: eq(users.email, 'demo@docsage.io'),
  });

  if (!demoUser) {
    const [created] = await db
      .insert(users)
      .values({
        tenantId: tenant.id,
        email: 'demo@docsage.io',
        passwordHash,
        role: 'viewer', // strictly read-only
      })
      .returning();

    if (!created) throw new Error('Failed to insert demo viewer user');
    demoUser = created;
  } else {
    // Update hash and role to enforce read-only status and fresh secret
    await db.update(users).set({ passwordHash, role: 'viewer' }).where(eq(users.id, demoUser.id));
  }

  // 4. Create Sample Architecture Document
  const sampleContent =
    'DocSage is an enterprise-grade Retrieval-Augmented Generation document platform engineered in TypeScript.';

  let doc = await db.query.documents.findFirst({
    where: eq(documents.tenantId, tenant.id),
  });

  if (!doc) {
    const [createdDoc] = await db
      .insert(documents)
      .values({
        tenantId: tenant.id,
        ownerId: demoUser.id,
        title: 'DocSage Architecture Overview',
        filename: 'architecture.pdf',
        mime: 'application/pdf',
        sizeBytes: 1024,
        contentSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        status: 'ready',
        version: 1,
      })
      .returning();

    if (!createdDoc) throw new Error('Failed to insert sample document');
    doc = createdDoc;

    // 5. Create Sample Chunk with 768-dim vector
    const embeddingDim = Number(process.env['EMBEDDING_DIM'] ?? 768);
    const sampleVector = Array.from({ length: embeddingDim }, (_, i) =>
      Number((Math.sin(i) * 0.1).toFixed(4)),
    );

    await db.insert(chunks).values({
      tenantId: tenant.id,
      documentId: doc.id,
      ordinal: 0,
      content: sampleContent,
      contentSha256: 'chunk_sha256_placeholder',
      page: 1,
      section: 'Introduction',
      tokenCount: 16,
      embedding: sampleVector,
    });
  }

  console.info(
    `✓ Demo seeding complete! Tenant ID: ${tenant.id}, User: demo@docsage.io (role: viewer)`,
  );
  return { tenantId: tenant.id, viewerUserId: demoUser.id };
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      console.error('Database seeding failed:', err);
      process.exit(1);
    });
}
