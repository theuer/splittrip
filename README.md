# SplitTrip

A simple, mobile-first web app for two friends to track shared trip expenses, adjust split percentages, and settle up — with multi-currency support and real-time exchange rates.

![SplitTrip](https://img.shields.io/badge/status-active-brightgreen) ![License](https://img.shields.io/badge/license-MIT-blue)

![SplitTrip screenshot](docs/screenshot.png)

## Features

- **Trip Management** — Create trips with two travelers and a base currency
- **Expense Tracking** — Log expenses with descriptions, amounts, and who paid
- **Flexible Splits** — Adjust the percentage split per expense (50/50, 70/30, etc.)
- **29 Currencies** — Select a different currency per expense (EUR, USD, GBP, MXN, JPY, and 24 more)
- **Real-Time Exchange Rates** — Automatic currency conversion via [Frankfurter API](https://www.frankfurter.app/) with 1-hour caching
- **Settlement Calculator** — See who owes whom, displayed in both the trip currency and your native currency
- **PIN Protection** — Optional 4-digit PIN per trip with SHA-256 hashing and rate limiting (5 failed attempts → 15-minute lockout)
- **Share Trips** — Share a trip link via Web Share API or clipboard
- **Dark Mode** — Light and dark themes with localStorage persistence
- **Mobile-First** — Designed for phones, works everywhere

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, TypeScript |
| Routing | wouter |
| Data Fetching | TanStack Query v5 |
| UI Components | shadcn/ui, Tailwind CSS |
| Backend | Express.js 5 |
| Database | PostgreSQL |
| ORM | Drizzle ORM |
| Validation | Zod + drizzle-zod |

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database

### Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-username/splittrip.git
   cd splittrip
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   Copy the example file and fill in your values:

   ```bash
   cp .env.example .env
   ```

   Then edit `.env` with your database connection string:

   | Variable | Description |
   |----------|-------------|
   | `DATABASE_URL` | PostgreSQL connection string, e.g. `postgresql://user:pass@localhost:5432/splittrip` |

4. **Push the database schema**

   ```bash
   npm run db:push
   ```

5. **Start the development server**

   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:5000`.

### Production Build

```bash
npm run build
npm start
```

## Data Model

### Trips

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key (auto-generated) |
| name | text | Trip name |
| person1 | text | First traveler's name |
| person2 | text | Second traveler's name |
| currency | text | Base currency code (default: EUR) |
| pinHash | text | SHA-256 hash of 4-digit PIN (nullable) |

### Expenses

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key (auto-generated) |
| tripId | UUID | Foreign key → trips (cascade delete) |
| description | text | What the expense was for |
| amount | real | Amount in the expense's currency |
| paidBy | text | Name of person who paid |
| person1Share | integer | Person 1's share as percentage 0–100 (default: 50) |
| currency | text | Currency code for this expense (default: EUR) |
| createdAt | timestamp | When the expense was created |

## API Reference

All endpoints return JSON. Protected endpoints require the `x-trip-pin` header if the trip has a PIN set.

### Trips

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/trips` | List all trips | — |
| `GET` | `/api/trips/:id` | Get a single trip | — |
| `POST` | `/api/trips` | Create a new trip | — |
| `DELETE` | `/api/trips/:id` | Delete a trip | PIN |
| `POST` | `/api/trips/:id/verify-pin` | Verify a trip's PIN | — |

**Create Trip** — `POST /api/trips`

```json
{
  "name": "Barcelona Weekend",
  "person1": "Alice",
  "person2": "Bob",
  "currency": "EUR",
  "pin": "1234"
}
```

The `pin` field is optional. If provided, it must be exactly 4 digits. The PIN is hashed server-side and never stored in plain text. The response never includes the hash — instead, a `hasPin` boolean is returned.

### Expenses

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/trips/:tripId/expenses` | List expenses for a trip | PIN |
| `POST` | `/api/expenses` | Create an expense | PIN |
| `DELETE` | `/api/expenses/:id` | Delete an expense | PIN |

**Create Expense** — `POST /api/expenses`

```json
{
  "tripId": "uuid-here",
  "description": "Dinner",
  "amount": 45.50,
  "paidBy": "Alice",
  "person1Share": 60,
  "currency": "EUR"
}
```

### Exchange Rates

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/exchange-rates/:base` | Get rates for a base currency (1-hour cache) |

## Security

- **PIN Hashing** — PINs are hashed with SHA-256 on the server. The hash is never exposed to clients.
- **Rate Limiting** — 5 failed PIN attempts trigger a 15-minute lockout per trip (in-memory, resets on server restart).
- **PIN Header** — Protected endpoints require the correct PIN via the `x-trip-pin` request header.
- **No User Accounts** — The app is intentionally account-free for simplicity. Anyone with the link (and PIN, if set) can access a trip.

## Project Structure

```
├── client/                  # Frontend (React + Vite)
│   ├── src/
│   │   ├── pages/           # Route pages (home, trip-detail)
│   │   ├── components/      # Dialogs, theme provider, shadcn/ui
│   │   ├── hooks/           # Custom hooks (toast, currency, mobile)
│   │   └── lib/             # Query client, utilities
│   └── index.html
├── server/                  # Backend (Express)
│   ├── routes.ts            # API route handlers
│   ├── storage.ts           # Database access layer
│   ├── pin.ts               # PIN hashing utilities
│   ├── rate-limit.ts        # Rate limiting for PIN attempts
│   ├── exchange-rates.ts    # Frankfurter API client with caching
│   └── db.ts                # Database connection
├── shared/
│   └── schema.ts            # Database schema, types, validation
└── package.json
```

## License

MIT
