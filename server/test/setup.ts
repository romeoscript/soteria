// Runs before config.ts is imported, so the env is valid and quiet.
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "fatal";
process.env.ADMIN_API_KEY ??= "test-admin-key-0123456789";
delete process.env.DATABASE_URL;
delete process.env.RELAYER_SECRET_KEY;
delete process.env.AUTHORITY_SECRET_KEY;
