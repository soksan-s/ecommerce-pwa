import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
});

export function query(text, params) {
  return pool.query(text, params);
}

export { pool };
