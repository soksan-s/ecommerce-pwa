SELECT
    migration_name,
    finished_at,
    rolled_back_at,
    logs
FROM "_prisma_migrations"
ORDER BY started_at;