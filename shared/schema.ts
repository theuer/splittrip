import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const CURRENCIES = [
  { code: "EUR", name: "Euro", symbol: "\u20AC" },
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "GBP", name: "British Pound", symbol: "\u00A3" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
  { code: "MXN", name: "Mexican Peso", symbol: "MX$" },
  { code: "JPY", name: "Japanese Yen", symbol: "\u00A5" },
  { code: "CAD", name: "Canadian Dollar", symbol: "CA$" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$" },
  { code: "SEK", name: "Swedish Krona", symbol: "kr" },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr" },
  { code: "DKK", name: "Danish Krone", symbol: "kr" },
  { code: "PLN", name: "Polish Zloty", symbol: "z\u0142" },
  { code: "CZK", name: "Czech Koruna", symbol: "K\u010D" },
  { code: "HUF", name: "Hungarian Forint", symbol: "Ft" },
  { code: "THB", name: "Thai Baht", symbol: "\u0E3F" },
  { code: "TRY", name: "Turkish Lira", symbol: "\u20BA" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$" },
  { code: "INR", name: "Indian Rupee", symbol: "\u20B9" },
  { code: "KRW", name: "South Korean Won", symbol: "\u20A9" },
  { code: "ZAR", name: "South African Rand", symbol: "R" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$" },
  { code: "CNY", name: "Chinese Yuan", symbol: "\u00A5" },
  { code: "ILS", name: "Israeli Shekel", symbol: "\u20AA" },
  { code: "COP", name: "Colombian Peso", symbol: "COL$" },
  { code: "ARS", name: "Argentine Peso", symbol: "AR$" },
  { code: "PEN", name: "Peruvian Sol", symbol: "S/" },
  { code: "CLP", name: "Chilean Peso", symbol: "CL$" },
] as const;

export const trips = pgTable("trips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  person1: text("person1").notNull(),
  person2: text("person2").notNull(),
  currency: text("currency").notNull().default("EUR"),
  pinHash: text("pin_hash"),
});

export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tripId: varchar("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  paidBy: text("paid_by").notNull(),
  person1Share: integer("person1_share").notNull().default(50),
  currency: text("currency").notNull().default("EUR"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertTripSchema = createInsertSchema(trips).omit({ id: true, pinHash: true }).extend({
  pin: z.string().regex(/^\d{4}$/, "PIN must be 4 digits").optional().or(z.literal("")),
});
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, createdAt: true });

export type InsertTrip = z.infer<typeof insertTripSchema>;
export type Trip = typeof trips.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;

export type TripPublic = Omit<Trip, "pinHash"> & { hasPin: boolean };
export type ExchangeRates = Record<string, number>;
