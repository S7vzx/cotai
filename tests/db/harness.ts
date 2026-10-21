import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..', '..')

/** Sobe um Postgres em memória com as migrações do Supabase aplicadas. */
export async function createDb() {
  const db = new PGlite()
  await db.exec(readFileSync(join(root, 'tests/db/supabase-stub.sql'), 'utf8'))
  const dir = join(root, 'supabase/migrations')
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    try {
      await db.exec(readFileSync(join(dir, file), 'utf8'))
    } catch (err) {
      throw new Error(`Falha na migração ${file}: ${(err as Error).message}`)
    }
  }
  return db
}

export type Db = PGlite

/**
 * Cria um usuário em auth.users. O primeiro vira admin pelo gatilho; com `role`,
 * cria o perfil como a Edge Function invite-user faz.
 */
export async function createUser(db: Db, email: string, role?: string, meta: Record<string, unknown> = {}) {
  const res = await db.query<{ id: string }>(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [
    email,
    JSON.stringify({ full_name: email, ...meta }),
  ])
  const id = res.rows[0].id
  if (role)
    await db.query(`insert into public.profiles (id, full_name, email, role) values ($1, $2, $2, $3) on conflict (id) do nothing`, [
      id,
      email,
      role,
    ])
  return id
}

/** Executa como um papel do Supabase (anon, authenticated com um usuário, ou service_role). */
export async function as<T>(
  db: Db,
  who: { role: 'anon' | 'authenticated' | 'service_role'; userId?: string },
  fn: () => Promise<T>,
): Promise<T> {
  await db.exec(`set role ${who.role}`)
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [who.userId ?? ''])
  try {
    return await fn()
  } finally {
    await db.exec('reset role')
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`)
  }
}
