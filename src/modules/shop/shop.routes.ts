import { Router } from 'express'
import { z } from 'zod'
import { StockMovementType, UserRole } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { asyncHandler } from '../../lib/async'
import { badRequest } from '../../lib/errors'
import { authenticate } from '../../middlewares/auth'
import { requireRoles, requireTenantUser } from '../../middlewares/rbac'
import { validate } from '../../middlewares/validate'
import { renderSaleReceiptPdf } from '../pdf/pdf.service'

export const shopRoutes = Router()
shopRoutes.use(authenticate, requireTenantUser)

const shopRoles = [UserRole.DIRECTOR, UserRole.ADMINISTRATION, UserRole.ACCOUNTANT, UserRole.STOCK_MANAGER, UserRole.SECRETARIAT] as const

shopRoutes.get(
  '/categories',
  asyncHandler(async (req, res) => {
    res.json({ categories: await prisma.productCategory.findMany({ where: { institutionId: req.institutionId! } }) })
  })
)

shopRoutes.post(
  '/categories',
  requireRoles(...shopRoles),
  validate(z.object({ body: z.object({ name: z.string().min(1), description: z.string().optional() }) })),
  asyncHandler(async (req, res) => {
    const category = await prisma.productCategory.create({ data: { institutionId: req.institutionId!, ...req.body } })
    res.status(201).json({ category })
  })
)

shopRoutes.post(
  '/suppliers',
  requireRoles(...shopRoles),
  validate(
    z.object({
      body: z.object({
        name: z.string().min(1),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        address: z.string().optional()
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const supplier = await prisma.supplier.create({ data: { institutionId: req.institutionId!, ...req.body } })
    res.status(201).json({ supplier })
  })
)

shopRoutes.get(
  '/products',
  asyncHandler(async (req, res) => {
    const products = await prisma.product.findMany({
      where: { institutionId: req.institutionId! },
      include: { category: true, supplier: true },
      orderBy: { name: 'asc' }
    })
    res.json({ products })
  })
)

shopRoutes.post(
  '/products',
  requireRoles(...shopRoles),
  validate(
    z.object({
      body: z.object({
        categoryId: z.string().optional(),
        supplierId: z.string().optional(),
        code: z.string().min(1),
        name: z.string().min(1),
        photoUrl: z.string().url().optional(),
        purchasePrice: z.number().int().nonnegative().default(0),
        salePrice: z.number().int().positive(),
        quantity: z.number().int().nonnegative().default(0),
        lowStockAlert: z.number().int().nonnegative().default(5)
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.create({
      data: {
        institutionId: req.institutionId!,
        ...req.body,
        movements:
          req.body.quantity > 0
            ? {
                create: {
                  institutionId: req.institutionId!,
                  type: StockMovementType.IN,
                  quantity: req.body.quantity,
                  unitPrice: req.body.purchasePrice,
                  reason: 'Stock initial',
                  createdById: req.user!.id
                }
              }
            : undefined
      },
      include: { movements: true }
    })
    res.status(201).json({ product })
  })
)

shopRoutes.post(
  '/movements',
  requireRoles(...shopRoles),
  validate(
    z.object({
      body: z.object({
        productId: z.string(),
        type: z.nativeEnum(StockMovementType),
        quantity: z.number().int().positive(),
        unitPrice: z.number().int().nonnegative().optional(),
        reason: z.string().optional()
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findFirst({ where: { id: req.body.productId, institutionId: req.institutionId! } })
    if (!product) throw badRequest('Produit introuvable')
    const delta = [StockMovementType.IN, StockMovementType.RETURN].includes(req.body.type) ? req.body.quantity : -req.body.quantity
    const movement = await prisma.$transaction(async (tx) => {
      const created = await tx.stockMovement.create({
        data: { institutionId: req.institutionId!, createdById: req.user!.id, ...req.body }
      })
      await tx.product.update({ where: { id: product.id }, data: { quantity: { increment: delta } } })
      return created
    })
    res.status(201).json({ movement })
  })
)

shopRoutes.post(
  '/sales',
  requireRoles(...shopRoles),
  validate(
    z.object({
      body: z.object({
        studentId: z.string().optional(),
        parentId: z.string().optional(),
        items: z.array(z.object({ productId: z.string(), quantity: z.number().int().positive() })).min(1)
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const sale = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { institutionId: req.institutionId!, id: { in: req.body.items.map((item: { productId: string }) => item.productId) } }
      })
      const items: Array<{ product: { id: string; name: string; quantity: number; salePrice: number }; quantity: number; total: number }> = req.body.items.map((item: { productId: string; quantity: number }) => {
        const product = products.find((candidate) => candidate.id === item.productId)
        if (!product) throw badRequest('Produit introuvable')
        if (product.quantity < item.quantity) throw badRequest(`Stock insuffisant pour ${product.name}`)
        return { product, quantity: item.quantity, total: product.salePrice * item.quantity }
      })
      const lastSale = await tx.sale.findFirst({
        where: { institutionId: req.institutionId! },
        orderBy: { number: 'desc' },
        select: { number: true }
      })
      const lastSaleSeq = lastSale ? (parseInt(lastSale.number.split('-').pop() ?? '0', 10) || 0) : 0
      const created = await tx.sale.create({
        data: {
          institutionId: req.institutionId!,
          number: `SALE-${new Date().getFullYear()}-${String(lastSaleSeq + 1).padStart(5, '0')}`,
          studentId: req.body.studentId,
          parentId: req.body.parentId,
          totalAmount: items.reduce((sum: number, item: { total: number }) => sum + item.total, 0),
          paidAmount: items.reduce((sum: number, item: { total: number }) => sum + item.total, 0),
          createdById: req.user!.id,
          items: {
            create: items.map((item: { product: { id: string; salePrice: number }; quantity: number; total: number }) => ({
              productId: item.product.id,
              quantity: item.quantity,
              unitPrice: item.product.salePrice,
              total: item.total
            }))
          }
        },
        include: { items: true }
      })
      await tx.sale.update({
        where: { id: created.id },
        data: { receiptUrl: `/api/shop/sales/${created.id}/receipt` }
      })
      const saleWithReceipt = await tx.sale.findUniqueOrThrow({ where: { id: created.id }, include: { items: true } })
      for (const item of items) {
        await tx.product.update({ where: { id: item.product.id }, data: { quantity: { decrement: item.quantity } } })
        await tx.stockMovement.create({
          data: {
            institutionId: req.institutionId!,
            productId: item.product.id,
            type: StockMovementType.SALE,
            quantity: item.quantity,
            unitPrice: item.product.salePrice,
            reason: `Vente ${created.number}`,
            createdById: req.user!.id
          }
        })
      }
      return saleWithReceipt
    })
    res.status(201).json({
      sale,
      pdfs: {
        receipt: `/api/shop/sales/${sale.id}/receipt`
      }
    })
  })
)

shopRoutes.get(
  '/sales/:id/receipt',
  asyncHandler(async (req, res) => {
    const buffer = await renderSaleReceiptPdf(req.institutionId!, req.params.id, String(req.query.lang ?? 'FR'))
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="recu-boutique-${req.params.id}.pdf"`)
    res.send(buffer)
  })
)

shopRoutes.get(
  '/low-stock',
  asyncHandler(async (req, res) => {
    const products = await prisma.product.findMany({
      where: { institutionId: req.institutionId!, isActive: true },
      orderBy: { quantity: 'asc' }
    })
    res.json({ products: products.filter((product) => product.quantity <= product.lowStockAlert) })
  })
)
