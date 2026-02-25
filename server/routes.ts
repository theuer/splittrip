import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertTripSchema, insertExpenseSchema, type TripPublic } from "@shared/schema";
import { ZodError } from "zod";
import { getExchangeRates } from "./exchange-rates";
import { verifyPin } from "./pin";
import { checkRateLimit, recordFailedAttempt, clearRateLimit } from "./rate-limit";

function toPublicTrip(trip: any): TripPublic {
  const { pinHash, ...rest } = trip;
  return { ...rest, hasPin: !!pinHash };
}

import type { Response } from "express";

function verifyPinWithRateLimit(tripId: string, pin: string | undefined, pinHash: string, res: Response): boolean {
  const limit = checkRateLimit(tripId);
  if (!limit.allowed) {
    res.status(429).json({ error: "Too many failed attempts. Try again later.", retryAfter: limit.retryAfter });
    return false;
  }

  if (!pin || !verifyPin(pin, pinHash)) {
    const result = recordFailedAttempt(tripId);
    if (result.locked) {
      res.status(429).json({ error: "Too many failed attempts. Try again later.", retryAfter: result.retryAfter });
    } else {
      res.status(403).json({ error: "Invalid PIN" });
    }
    return false;
  }

  clearRateLimit(tripId);
  return true;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/trips", async (_req, res) => {
    const trips = await storage.getTrips();
    res.json(trips.map(toPublicTrip));
  });

  app.get("/api/trips/:id", async (req, res) => {
    const trip = await storage.getTrip(req.params.id);
    if (!trip) return res.status(404).json({ error: "Trip not found" });
    res.json(toPublicTrip(trip));
  });

  app.post("/api/trips", async (req, res) => {
    try {
      const data = insertTripSchema.parse(req.body);
      const trip = await storage.createTrip(data);
      res.status(201).json(toPublicTrip(trip));
    } catch (e) {
      if (e instanceof ZodError) return res.status(400).json({ error: e.message });
      throw e;
    }
  });

  app.delete("/api/trips/:id", async (req, res) => {
    const trip = await storage.getTrip(req.params.id);
    if (!trip) return res.status(404).json({ error: "Trip not found" });

    if (trip.pinHash) {
      const pin = req.headers["x-trip-pin"] as string;
      if (!verifyPinWithRateLimit(req.params.id, pin, trip.pinHash, res)) return;
    }

    await storage.deleteTrip(req.params.id);
    res.status(204).send();
  });

  app.post("/api/trips/:id/verify-pin", async (req, res) => {
    const trip = await storage.getTrip(req.params.id);
    if (!trip) return res.status(404).json({ error: "Trip not found" });

    if (!trip.pinHash) {
      return res.json({ valid: true });
    }

    const { pin } = req.body;
    if (!pin || typeof pin !== "string") {
      return res.status(400).json({ error: "PIN is required" });
    }

    const limit = checkRateLimit(req.params.id);
    if (!limit.allowed) {
      return res.status(429).json({ error: "Too many failed attempts. Try again later.", retryAfter: limit.retryAfter });
    }

    const valid = verifyPin(pin, trip.pinHash);
    if (!valid) {
      const result = recordFailedAttempt(req.params.id);
      if (result.locked) {
        return res.status(429).json({ error: "Too many failed attempts. Try again later.", retryAfter: result.retryAfter });
      }
      return res.json({ valid: false });
    }

    clearRateLimit(req.params.id);
    res.json({ valid: true });
  });

  app.get("/api/trips/:tripId/expenses", async (req, res) => {
    const trip = await storage.getTrip(req.params.tripId);
    if (!trip) return res.status(404).json({ error: "Trip not found" });

    if (trip.pinHash) {
      const pin = req.headers["x-trip-pin"] as string;
      if (!verifyPinWithRateLimit(req.params.tripId, pin, trip.pinHash, res)) return;
    }

    const expenses = await storage.getExpensesByTrip(req.params.tripId);
    res.json(expenses);
  });

  app.post("/api/expenses", async (req, res) => {
    try {
      const data = insertExpenseSchema.parse(req.body);

      const trip = await storage.getTrip(data.tripId);
      if (!trip) return res.status(404).json({ error: "Trip not found" });

      if (trip.pinHash) {
        const pin = req.headers["x-trip-pin"] as string;
        if (!verifyPinWithRateLimit(data.tripId, pin, trip.pinHash, res)) return;
      }

      const expense = await storage.createExpense(data);
      res.status(201).json(expense);
    } catch (e) {
      if (e instanceof ZodError) return res.status(400).json({ error: e.message });
      throw e;
    }
  });

  app.delete("/api/expenses/:id", async (req, res) => {
    const expense = await storage.getExpense(req.params.id);
    if (!expense) return res.status(404).json({ error: "Expense not found" });

    const trip = await storage.getTrip(expense.tripId);
    if (trip?.pinHash) {
      const pin = req.headers["x-trip-pin"] as string;
      if (!verifyPinWithRateLimit(trip.id, pin, trip.pinHash, res)) return;
    }

    await storage.deleteExpense(req.params.id);
    res.status(204).send();
  });

  app.get("/api/exchange-rates/:base", async (req, res) => {
    try {
      const rates = await getExchangeRates(req.params.base);
      res.json(rates);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch exchange rates" });
    }
  });

  return httpServer;
}
