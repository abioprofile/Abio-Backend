// Read-only smoke check against DATABASE_URL. Never resets or truncates data.
require('dotenv').config()
const { readdirSync } = require('node:fs')
const { join } = require('node:path')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
async function main() {
  await prisma.aStoreOrder.findMany({ take: 1, include: { items: { include: { product: true, variant: true } }, payment: true, user: { select: { id: true } } } })
  await prisma.aStoreProduct.findMany({ take: 1, include: { variants: true } })
  await prisma.adminInvite.findMany({ take: 1, include: { invitedBy: { select: { id: true } }, acceptedUser: { select: { id: true } } } })
  const applied = await prisma.$queryRaw`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`
  const names = new Set(applied.map(row => row.migration_name))
  const missing = readdirSync(join(__dirname, '../prisma/migrations'), { withFileTypes: true }).filter(entry => entry.isDirectory() && !names.has(entry.name))
  if (missing.length) throw new Error('Unapplied migrations: ' + missing.map(entry => entry.name).join(', '))
  const pending = await prisma.$queryRaw`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL`
  if (pending.length) throw new Error('A failed or unfinished database migration exists.')
  console.log('PASS: real database order, item snapshot, product gallery, variant, payment, and invitation queries.')
}
main().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(() => prisma.$disconnect())
