import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const phoneNumber = process.env.SEED_ADMIN_PHONE_NUMBER ?? '13900139000'
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'password123'
  const displayName = process.env.SEED_ADMIN_DISPLAY_NAME ?? 'Admin User'
  const passwordHash = await hash(password, 12)

  const user = await prisma.user.upsert({
    where: {
      phoneNumber
    },
    update: {
      passwordHash,
      displayName,
      role: 'super_admin',
      status: 'active'
    },
    create: {
      phoneNumber,
      passwordHash,
      displayName,
      role: 'super_admin',
      status: 'active'
    }
  })

  console.log(`Seeded admin user ${user.phoneNumber} (${user.role})`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
