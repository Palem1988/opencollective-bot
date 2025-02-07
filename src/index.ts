import { Server } from 'http'
import { createProbot, ApplicationFunction } from 'probot'
import { findPrivateKey } from 'probot/lib/private-key'
import { logRequestErrors } from 'probot/lib/middleware/log-request-errors'
import { createWebhookProxy } from 'probot/lib/webhook-proxy'

import { opencollective } from './bot'
import { validator } from './validate'

const port = Number(process.env.PORT) || 3000

/* istanbul ignore if */
if (process.env.NODE_ENV !== 'test') {
  try {
    main(port)
  } catch (err) {
    console.log(err)
  }
}

export function main(port: number): Server {
  /* Credentials */

  if (
    !process.env.APP_ID ||
    !process.env.WEBHOOK_SECRET ||
    !(process.env.PRIVATE_KEY || process.env.PRIVATE_KEY_PATH)
  ) {
    throw new Error('Missing credentials.')
  }

  /* Probot setup */

  const cert = findPrivateKey() as string

  const probot = createProbot({
    id: parseInt(process.env.APP_ID, 10),
    secret: process.env.WEBHOOK_SECRET,
    cert: cert,
    port: port,
  })

  /* Load apps */

  const apps: ApplicationFunction[] = [
    opencollective,
    require('probot/lib/apps/default'),
    require('probot/lib/apps/sentry'),
    require('probot/lib/apps/stats'),
  ]
  ;(process as NodeJS.EventEmitter).on(
    'unhandledRejection',
    probot.errorHandler,
  )

  apps.forEach(appFn => probot.load(appFn))

  /* Load express apps */

  probot.server.use('/validate', validator)

  // Register error handler as the last middleware
  probot.server.use(logRequestErrors as any)

  /* Load Webhook Proxy */

  if (process.env.WEBHOOK_PROXY_URL) {
    createWebhookProxy({
      logger: probot.logger,
      port,
      path: '/',
      url: process.env.WEBHOOK_PROXY_URL,
    })
  }

  /* Start the server */

  const server = probot.server.listen(port)

  return server
}
