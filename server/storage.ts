import {
  type Trip, type InsertTrip,
  type Expense, type InsertExpense,
  trips, expenses,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import { hashPin } from "./pin";

export interface IStorage {
  getTrips(): Promise<Trip[]>;
  getTrip(id: string): Promise<Trip | undefined>;
  createTrip(trip: InsertTrip): Promise<Trip>;
  deleteTrip(id: string): Promise<void>;
  getExpensesByTrip(tripId: string): Promise<Expense[]>;
  getExpense(id: string): Promise<Expense | undefined>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  deleteExpense(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getTrips(): Promise<Trip[]> {
    return db.select().from(trips);
  }

  async getTrip(id: string): Promise<Trip | undefined> {
    const [trip] = await db.select().from(trips).where(eq(trips.id, id));
    return trip;
  }

  async createTrip(data: InsertTrip): Promise<Trip> {
    const { pin, ...tripData } = data;
    const values: any = { ...tripData };
    if (pin) {
      values.pinHash = hashPin(pin);
    }
    const [created] = await db.insert(trips).values(values).returning();
    return created;
  }

  async deleteTrip(id: string): Promise<void> {
    await db.delete(trips).where(eq(trips.id, id));
  }

  async getExpensesByTrip(tripId: string): Promise<Expense[]> {
    return db.select().from(expenses).where(eq(expenses.tripId, tripId)).orderBy(desc(expenses.createdAt));
  }

  async createExpense(expense: InsertExpense): Promise<Expense> {
    const [created] = await db.insert(expenses).values(expense).returning();
    return created;
  }

  async getExpense(id: string): Promise<Expense | undefined> {
    const [expense] = await db.select().from(expenses).where(eq(expenses.id, id));
    return expense;
  }

  async deleteExpense(id: string): Promise<void> {
    await db.delete(expenses).where(eq(expenses.id, id));
  }
}

export const storage = new DatabaseStorage();
