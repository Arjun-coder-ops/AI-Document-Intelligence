import { db } from './client.js';
import { tenants, users, documents, chunks } from './schema/index.js';

export async function seedDatabase(): Promise<{ tenantId: string; adminUserId: string }> {
  console.info('Seeding database with initial demo workspace and users...');

  // 1. Create Demo Tenant
  const [tenant] = await db
    .insert(tenants)
    .values({
      name: 'DocSage Demo Workspace',
    })
    .returning({ id: tenants.id });

  if (!tenant) throw new Error('Failed to insert demo tenant');

  // 2. Create Users (admin, editor, viewer)
  // Password hash for demo 'Password123!' (argon2 or placeholder)
  const passwordHash = '$argon2id$v=19$m=65536,t=3,p=4$dummyhashfordemopassword123';

  const [adminUser] = await db
    .insert(users)
    .values([
      {
        tenantId: tenant.id,
        email: 'admin@docsage.io',
        passwordHash,
        role: 'admin',
      },
      {
        tenantId: tenant.id,
        email: 'editor@docsage.io',
        passwordHash,
        role: 'editor',
      },
      {
        tenantId: tenant.id,
        email: 'viewer@docsage.io',
        passwordHash,
        role: 'viewer',
      },
    ])
    .returning({ id: users.id });

  if (!adminUser) throw new Error('Failed to insert admin user');

  // 3. Create Sample Document
  const sampleContent =
    'DocSage is an enterprise-grade Retrieval-Augmented Generation document platform engineered in TypeScript.';
  const [doc] = await db
    .insert(documents)
    .values({
      tenantId: tenant.id,
      ownerId: adminUser.id,
      title: 'DocSage Architecture Overview',
      filename: 'architecture.pdf',
      mime: 'application/pdf',
      sizeBytes: 1024,
      contentSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      status: 'ready',
      version: 1,
    })
    .returning({ id: documents.id });

  if (!doc) throw new Error('Failed to insert sample document');

  // 4. Create Sample Chunk with 384-dim dummy vector
  const embeddingDim = Number(process.env['EMBEDDING_DIM'] ?? 384);
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

  console.info(`✓ Seed complete! Tenant ID: ${tenant.id}`);
  return { tenantId: tenant.id, adminUserId: adminUser.id };
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      console.error('Database seeding failed:', err);
      process.exit(1);
    });
}
