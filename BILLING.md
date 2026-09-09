# MovieFlix billing and PayMongo

MovieFlix calculates prices and promotion eligibility on the server and stores an immutable order snapshot in integer centavos. PayMongo processes QR Ph payments. Only a verified PayMongo webhook can mark a paid order and extend access. The legacy `payment_submissions` data remains read-only and is not used for new access.

## Safe upgrade

Never use the wipeout installer option for an upgrade. Before deployment, stop writes briefly or use SQLite's online backup API from the running container:

```sh
docker compose exec -T app node -e 'const D=require("better-sqlite3");const s=new D("./data/database.sqlite");s.backup("./data/backups/database-before-paymongo.sqlite").then(()=>s.close())'
```

Use `./install.sh` and select **Update only**. Startup creates new tables and columns with additive `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ADD COLUMN` operations. It does not delete legacy data.

## Test setup

Set `PAYMONGO_SECRET_KEY`, `PAYMONGO_PUBLIC_KEY`, and `PAYMONGO_WEBHOOK_SECRET` in `.env`, using test keys first. Configure this public HTTPS webhook in PayMongo:

`https://YOUR_DOMAIN/api/billing/webhook/paymongo`

Subscribe to `payment.paid`, `payment.failed`, and `qrph.expired`. Test and live webhook endpoints have separate secrets. Rebuild/restart with the update-only installer after changing `.env`.

QR Ph creates a single-use dynamic code that expires after about 30 minutes. It is a one-time payment method and does not provide automatic recurring debits. MovieFlix therefore keeps auto-renew off for QR Ph and customers renew through a new checkout.

## Lifecycle and safety

Orders use CREATED, PENDING, PROCESSING, PAID, FAILED, EXPIRED, CANCELLED, and refund-ready states. Promo use is reserved while a QR is pending, released on failure/expiry, and counted only when paid. A unique provider event ID and an atomic paid transition prevent duplicate webhooks from extending access twice. Active time purchases extend from the later of the current expiry or payment time; lifetime purchases set no expiry.

Historical manual receipts remain in the database for audit, but there is no approval action in the admin panel and new checkouts cannot upload receipts.

## Rollback

Keep the pre-upgrade SQLite backup. Roll back the application image/commit and retain the current database; older code ignores the additive billing tables. Restore the database backup only if an integrity or migration failure is confirmed, while MovieFlix is stopped. Never delete Docker volumes.
