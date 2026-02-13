# Production Smoke Checklist

## 1) Environment and Secrets
- Set required env vars in production: `JWT_SECRET`, `DEFAULT_TELEGRAM_BOT_TOKEN`, `META_APP_SECRET`, `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`, `NEXT_PUBLIC_BASE_URL`, `DATABASE_URL`.
- Ensure no default or placeholder secrets are used.
- Confirm production domain and webhook URLs match real deploy URL.

## 2) Build and Database
- Run `npm run build` and confirm successful compile/type-check.
- Run `npm run db:check` and confirm database connectivity.
- If migrations are pending, run `npm run db:migrate-deploy`.
- Verify Prisma client generation after deploy (`postinstall` or build step).

## 3) Authentication Flows
- Email login works for existing account.
- Telegram OAuth login works for existing account.
- Telegram OAuth registration creates a new business correctly.
- Forgot password via Telegram returns reset link and allows setting a new password.
- Self-delete from settings works only from trusted device.

## 4) Integrations and Webhooks
- Telegram webhook is configured and `GET /api/telegram/webhook?businessId=...` shows correct URL.
- Telegram inbound messages appear in dashboard social inbox.
- Instagram webhook verification (`GET`) returns challenge with valid token.
- Instagram webhook (`POST`) accepts valid signature and rejects invalid signature.
- Rate limiting returns `429` on burst traffic for auth/webhook endpoints.

## 5) Dashboard and Core Modules
- Open dashboard pages: appointments, clients, masters, price, schedule, analytics, settings.
- Create/edit/delete service, master, client, appointment.
- Check that business data isolation works (no cross-business data visibility).
- Verify Telegram settings page: users/passwords loading and webhook enable action.

## 6) Admin Control Center
- Admin login works with valid token.
- Business list and analytics load.
- Delete by `businessIdentifier` works only with admin authorization.
- No sensitive internal error details are returned to client responses.

## 7) Final Sanity
- Check browser console for runtime errors on critical pages.
- Confirm API responses include security headers for `/api/*`.
- Confirm no hardcoded secrets remain in repository.
- Tag release only after all items above pass.
