# Quick Setup Guide

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

## Installation Steps

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set Up Environment**
   ```bash
   cp .env.example .env
   ```
   The `.env` file should contain:
   ```
   DATABASE_URL="file:./dev.db"
   ```

3. **Initialize Database**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Seed Test Data**
   ```bash
   npm run db:seed
   ```
   This creates:
   - 3 services (Чоловіча стрижка, Стрижка бороди, Комплекс)
   - 2 masters (Олександр, Дмитро)

5. **Start Development Server**
   ```bash
   npm run dev
   ```

6. **Access the Application**
   - Booking: http://localhost:3000/booking
   - Admin: http://localhost:3000/admin
   - QR Generator: http://localhost:3000/qr

## Production Build

```bash
npm run build
npm start
```

## Database Management

- View database: `npx prisma studio`
- Reset database: Delete `prisma/dev.db` and run `npx prisma db push` again
- Re-seed: `npm run db:seed`

## Notes

- The system uses SQLite by default (good for development)
- For production, consider switching to PostgreSQL by updating `DATABASE_URL` in `.env`
- PWA features are disabled in development mode (enabled in production)




