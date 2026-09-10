import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ sendMail: vi.fn(), create: vi.fn(), user: vi.fn(), count: vi.fn(), findMany: vi.fn() }))
vi.mock('@/env', () => ({ default: { ADMIN_URL: 'https://admin.example.com', NODE_ENV: 'test' } }))
vi.mock('@/shared/utils/email/transporter', () => ({ sendMail: mocks.sendMail }))
vi.mock('@/modules/auth/auth.tokens', () => ({ createRawToken: () => ({raw:'test-token',hash:'hashed-token'}) }))
vi.mock('@/shared/config/database', () => ({ prisma: {
  user:{findUnique:mocks.user},
  adminInvite: {count: mocks.count, findMany: mocks.findMany},
  $transaction: async (fn: any) => fn({adminInvite:{deleteMany:vi.fn(),create:mocks.create},adminAuditLog:{create:vi.fn()}}),
} }))
import { createInvite, listInvites } from '@/modules/admin/admin.service'
beforeEach(() => {vi.clearAllMocks();mocks.user.mockResolvedValue(null);mocks.create.mockResolvedValue({id:'i1',email:'guest@example.com',role:'moderator',expiresAt:new Date(),createdAt:new Date()});mocks.sendMail.mockResolvedValue(undefined)})
it('emails the matching recipient with an admin acceptance link after creating the invitation', async () => {
 const result = await createInvite({email:'Guest@Example.com'},'a1')
 expect(mocks.sendMail).toHaveBeenCalledWith(expect.objectContaining({to:'guest@example.com',html:expect.stringContaining('https://admin.example.com/admin/accept-invite?token=test-token')}))
 expect(JSON.stringify(result)).toContain('"emailStatus":"sent"')
 expect(mocks.create.mock.calls[0][0].data.tokenHash).toBe('hashed-token')
})
it('reports failed email delivery while keeping a usable manual link', async () => {
 mocks.sendMail.mockRejectedValue(new Error('provider unavailable'))
 const result = await createInvite({email:'guest@example.com'},'a1')
 expect(JSON.stringify(result)).toContain('"emailStatus":"failed"')
 expect(JSON.stringify(result)).toContain('https://admin.example.com/admin/accept-invite?token=test-token')
})

it('identifies rejected SMTP credentials without exposing provider secrets', async () => {
 mocks.sendMail.mockRejectedValue(Object.assign(new Error('private detail'), {code:'EAUTH'}))
 const result = await createInvite({email:'guest@example.com'},'a1')
 expect(JSON.stringify(result)).toContain('rejected the SMTP credentials')
 expect(JSON.stringify(result)).not.toContain('private detail')
})
it('applies case-insensitive email search to both count and paginated results', async () => {
 mocks.count.mockResolvedValue(0); mocks.findMany.mockResolvedValue([])
 await listInvites({q:' Guest ',status:'pending',page:'2',limit:'10'})
 const countWhere=mocks.count.mock.calls[0][0].where
 expect(countWhere.email).toEqual({contains:'Guest',mode:'insensitive'})
 expect(countWhere.acceptedAt).toBe(null)
 expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({where:countWhere,skip:10,take:10}))
})
