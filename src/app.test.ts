import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from './app'

describe('SoraSchool API smoke tests', () => {
  const app = createApp()

  it('exposes a health endpoint', async () => {
    const response = await request(app).get('/health').expect(200)

    expect(response.body).toMatchObject({
      ok: true,
      name: 'SoraSchool API'
    })
    expect(typeof response.body.uptime).toBe('number')
  })

  it('exposes the API index', async () => {
    const response = await request(app).get('/api').expect(200)

    expect(response.body).toMatchObject({
      ok: true,
      name: 'SoraSchool API',
      docs: '/docs/',
      health: '/health'
    })
  })
})
