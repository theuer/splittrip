# SplitTrip - Trip Expense Splitter

## Overview
A simple, mobile-first web app for two friends to track shared trip expenses, see who paid for what, adjust split percentages, and settle up easily.

## Architecture
- **Frontend**: React + Vite, wouter routing, TanStack Query, shadcn/ui components, Tailwind CSS
- **Backend**: Express.js REST API
- **Database**: PostgreSQL with Drizzle ORM
- **Design**: Mobile-first, Plus Jakarta Sans font, light/dark mode with localStorage persistence

## Data Model
- `trips`: id, name, person1, person2, currency, pinHash (nullable)
- `expenses`: id, tripId, description, amount, paidBy, person1Share (percentage 0-100), currency, createdAt

## Key Pages
- `/` - Home: List of trips (lock icon for PIN-protected), create new trip, "My Currency" selector
- `/trip/:id` - Trip detail: PIN gate if protected, settlement summary (in native + trip currency), expense list, add/delete expenses, share button

## API Routes
- `GET /api/trips` - List all trips (returns TripPublic with hasPin boolean, never exposes hash)
- `GET /api/trips/:id` - Get single trip (TripPublic)
- `POST /api/trips` - Create trip (accepts optional `pin` field, 4 digits)
- `DELETE /api/trips/:id` - Delete trip (requires x-trip-pin header if protected)
- `POST /api/trips/:id/verify-pin` - Verify PIN { pin: "1234" } -> { valid: boolean }
- `GET /api/trips/:tripId/expenses` - List expenses (requires x-trip-pin if protected)
- `POST /api/expenses` - Create expense (requires x-trip-pin if protected)
- `DELETE /api/expenses/:id` - Delete expense (requires x-trip-pin if protected)
- `GET /api/exchange-rates/:base` - Get exchange rates for a base currency (1hr cache)

## User Preferences
- "My Currency" stored in localStorage (`splittrip-my-currency`), used to show settlement in traveler's native currency
- Theme preference (light/dark) stored in localStorage
- PIN per trip stored in localStorage (`splittrip-pin-{tripId}`), remembered on device

## Security
- PIN hashing: SHA-256, server-side only
- Rate limiting: 5 failed PIN attempts → 15-minute lockout (in-memory)
- PIN never exposed to client; `hasPin` boolean returned instead

## Project Structure
- `client/src/pages/` - Route pages (home.tsx, trip-detail.tsx, not-found.tsx)
- `client/src/components/` - Dialogs (add-expense, create-trip), theme provider
- `client/src/components/ui/` - shadcn/ui primitives (14 components, unused ones removed)
- `client/src/hooks/` - Custom hooks (toast, currency, mobile detection)
- `client/src/lib/` - Query client config, utilities
- `server/` - Express routes, storage layer, PIN/rate-limit utils, exchange rate client
- `shared/schema.ts` - Drizzle schema, Zod validation, types, currency list
