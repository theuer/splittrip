import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { TripPublic, Expense, ExchangeRates } from "@shared/schema";
import { useParams, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Trash2, Receipt, ArrowRightLeft, Sun, Moon, RefreshCw, Share2, Lock } from "lucide-react";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { AddExpenseDialog } from "@/components/add-expense-dialog";
import { useTheme } from "@/components/theme-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useMyCurrency } from "@/hooks/use-my-currency";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function convertAmount(amount: number, fromCurrency: string, toCurrency: string, rates: ExchangeRates): number {
  if (fromCurrency === toCurrency) return amount;
  const fromRate = rates[fromCurrency];
  const toRate = rates[toCurrency];
  if (!fromRate || !toRate) return amount;
  return (amount / fromRate) * toRate;
}

function getStoredPin(tripId: string): string {
  try {
    return localStorage.getItem(`splittrip-pin-${tripId}`) || "";
  } catch {
    return "";
  }
}

function storePin(tripId: string, pin: string) {
  try {
    localStorage.setItem(`splittrip-pin-${tripId}`, pin);
  } catch {}
}

export default function TripDetail() {
  const params = useParams<{ id: string }>();
  const tripId = params.id;
  const [, navigate] = useLocation();
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const { myCurrency } = useMyCurrency();

  const [pinUnlocked, setPinUnlocked] = useState<boolean>(() => !!getStoredPin(tripId));
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinVerifying, setPinVerifying] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const lockoutTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (lockoutSeconds > 0) {
      lockoutTimer.current = setInterval(() => {
        setLockoutSeconds((s) => {
          if (s <= 1) {
            if (lockoutTimer.current) clearInterval(lockoutTimer.current);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
      return () => { if (lockoutTimer.current) clearInterval(lockoutTimer.current); };
    }
  }, [lockoutSeconds > 0]);

  const storedPin = getStoredPin(tripId);

  const { data: trip, isLoading: tripLoading } = useQuery<TripPublic>({
    queryKey: ["/api/trips", tripId],
  });

  const needsPin = trip?.hasPin && !pinUnlocked;

  const { data: expenses, isLoading: expensesLoading } = useQuery<Expense[]>({
    queryKey: ["/api/trips", tripId, "expenses"],
    enabled: !!trip && !needsPin,
    meta: storedPin ? { pin: storedPin } : undefined,
  });

  const { data: rates, isLoading: ratesLoading } = useQuery<ExchangeRates>({
    queryKey: ["/api/exchange-rates", trip?.currency ?? "EUR"],
    enabled: !!trip && !needsPin,
    staleTime: 60 * 60 * 1000,
  });

  const deleteExpense = useMutation({
    mutationFn: async (expenseId: string) => {
      const pin = getStoredPin(tripId);
      await apiRequest("DELETE", `/api/expenses/${expenseId}`, undefined, pin ? { "x-trip-pin": pin } : undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "expenses"] });
      setDeleteExpenseId(null);
      toast({ title: "Expense deleted" });
    },
  });

  const hasMultipleCurrencies = useMemo(() => {
    if (!expenses || !trip) return false;
    return expenses.some((e) => e.currency !== trip.currency);
  }, [expenses, trip]);

  const showNativeCurrency = myCurrency && trip && myCurrency !== trip.currency;

  const settlement = useMemo(() => {
    if (!trip || !expenses || !rates) return null;

    let person1Paid = 0;
    let person2Paid = 0;
    let person1Owes = 0;
    let person2Owes = 0;
    let total = 0;

    for (const exp of expenses) {
      const amountInBase = convertAmount(exp.amount, exp.currency, trip.currency, rates);
      total += amountInBase;
      const p1Share = (exp.person1Share / 100) * amountInBase;
      const p2Share = ((100 - exp.person1Share) / 100) * amountInBase;

      if (exp.paidBy === trip.person1) {
        person1Paid += amountInBase;
      } else {
        person2Paid += amountInBase;
      }

      person1Owes += p1Share;
      person2Owes += p2Share;
    }

    const person1Balance = person1Paid - person1Owes;
    const settlementAmount = Math.abs(person1Balance);
    const owesPerson = person1Balance > 0 ? trip.person2 : trip.person1;
    const owedPerson = person1Balance > 0 ? trip.person1 : trip.person2;

    return {
      total,
      person1Paid,
      person2Paid,
      person1Owes,
      person2Owes,
      settlementAmount,
      owesPerson,
      owedPerson,
      isSettled: settlementAmount < 0.01,
    };
  }, [trip, expenses, rates]);

  const handlePinSubmit = useCallback(async () => {
    if (lockoutSeconds > 0) return;
    if (pinInput.length !== 4) {
      setPinError("Enter a 4-digit PIN");
      return;
    }
    setPinVerifying(true);
    setPinError("");
    try {
      const res = await fetch(`/api/trips/${tripId}/verify-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinInput }),
      });
      if (res.status === 429) {
        const data = await res.json();
        setLockoutSeconds(data.retryAfter || 900);
        setPinError("");
        setPinInput("");
        return;
      }
      const { valid } = await res.json();
      if (valid) {
        storePin(tripId, pinInput);
        setPinUnlocked(true);
        queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "expenses"] });
      } else {
        setPinError("Incorrect PIN");
        setPinInput("");
      }
    } catch {
      setPinError("Failed to verify PIN");
    } finally {
      setPinVerifying(false);
    }
  }, [pinInput, tripId, lockoutSeconds]);

  async function handleShare() {
    const url = window.location.href;
    const text = `Join my trip "${trip?.name}" on SplitTrip and add your expenses!`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `SplitTrip - ${trip?.name}`, text, url });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          copyToClipboard(url);
        }
      }
    } else {
      copyToClipboard(url);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(
      () => toast({ title: "Link copied to clipboard!" }),
      () => toast({ title: "Could not copy link", variant: "destructive" })
    );
  }

  if (tripLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-lg mx-auto px-4 py-6">
          <Skeleton className="h-8 w-48 mb-6" />
          <Skeleton className="h-32 w-full mb-4" />
          <Skeleton className="h-16 w-full mb-3" />
          <Skeleton className="h-16 w-full mb-3" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-6 text-center max-w-xs">
          <h2 className="font-semibold text-foreground mb-2">Trip not found</h2>
          <Button variant="outline" onClick={() => navigate("/")} data-testid="button-go-home">Go Home</Button>
        </Card>
      </div>
    );
  }

  if (needsPin) {
    const isLockedOut = lockoutSeconds > 0;
    const lockoutMinutes = Math.floor(lockoutSeconds / 60);
    const lockoutSecs = lockoutSeconds % 60;
    const lockoutDisplay = lockoutMinutes > 0
      ? `${lockoutMinutes}m ${lockoutSecs.toString().padStart(2, "0")}s`
      : `${lockoutSecs}s`;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="p-6 max-w-xs w-full" data-testid="card-pin-entry">
          <div className="text-center mb-4">
            <div className="w-12 h-12 rounded-md bg-accent mx-auto mb-3 flex items-center justify-center">
              <Lock className="w-6 h-6 text-muted-foreground" />
            </div>
            <h2 className="font-semibold text-foreground mb-1">{trip.name}</h2>
            <p className="text-sm text-muted-foreground">This trip is PIN protected</p>
          </div>
          <div className="space-y-3">
            {isLockedOut ? (
              <div className="text-center py-2" data-testid="text-lockout">
                <p className="text-sm text-destructive font-medium mb-1">Too many failed attempts</p>
                <p className="text-sm text-muted-foreground">Try again in {lockoutDisplay}</p>
              </div>
            ) : (
              <>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  placeholder="Enter 4-digit PIN"
                  value={pinInput}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                    setPinInput(val);
                    setPinError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handlePinSubmit();
                  }}
                  className="text-center text-lg tracking-[0.2em]"
                  autoFocus
                  data-testid="input-pin"
                />
                {pinError && (
                  <p className="text-sm text-destructive text-center" data-testid="text-pin-error">{pinError}</p>
                )}
                <Button
                  className="w-full"
                  onClick={handlePinSubmit}
                  disabled={pinVerifying || pinInput.length !== 4}
                  data-testid="button-submit-pin"
                >
                  {pinVerifying ? "Verifying..." : "Unlock"}
                </Button>
              </>
            )}
            <Button variant="ghost" className="w-full" onClick={() => navigate("/")} data-testid="button-pin-back">
              Back to Trips
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-lg mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-foreground truncate" data-testid="text-trip-title">{trip.name}</h1>
              <p className="text-xs text-muted-foreground">{trip.person1} & {trip.person2}</p>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" onClick={handleShare} data-testid="button-share">
              <Share2 className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleTheme} data-testid="button-theme-toggle-detail">
              {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {expensesLoading ? (
          <div>
            <Skeleton className="h-32 w-full mb-4" />
            <Skeleton className="h-16 w-full mb-3" />
            <Skeleton className="h-16 w-full mb-3" />
          </div>
        ) : (
          <>
            {settlement && (
              <Card className="p-4 mb-4" data-testid="card-settlement">
                <div className="flex items-center gap-2 mb-3">
                  <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-foreground">Settlement</h2>
                  {(hasMultipleCurrencies || showNativeCurrency) && (
                    <Badge variant="secondary" className="text-xs ml-auto">
                      in {showNativeCurrency ? myCurrency : trip.currency}
                    </Badge>
                  )}
                </div>

                {ratesLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Loading exchange rates...
                  </div>
                ) : settlement.isSettled ? (
                  <p className="text-sm text-muted-foreground" data-testid="text-settled">All settled up!</p>
                ) : (
                  <div className="bg-accent rounded-md p-3">
                    {showNativeCurrency && rates ? (
                      <>
                        <p className="text-sm text-foreground" data-testid="text-settlement-info">
                          <span className="font-semibold">{settlement.owesPerson}</span> owes{" "}
                          <span className="font-semibold">{settlement.owedPerson}</span>{" "}
                          <span className="font-bold text-primary">
                            {formatCurrency(
                              convertAmount(settlement.settlementAmount, trip.currency, myCurrency, rates),
                              myCurrency
                            )}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1" data-testid="text-settlement-secondary">
                          {formatCurrency(settlement.settlementAmount, trip.currency)} in trip currency
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-foreground" data-testid="text-settlement-info">
                        <span className="font-semibold">{settlement.owesPerson}</span> owes{" "}
                        <span className="font-semibold">{settlement.owedPerson}</span>{" "}
                        <span className="font-bold text-primary">
                          {formatCurrency(settlement.settlementAmount, trip.currency)}
                        </span>
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-0.5">Total</p>
                    {showNativeCurrency && rates ? (
                      <>
                        <p className="text-sm font-semibold text-foreground" data-testid="text-total">
                          {formatCurrency(convertAmount(settlement.total, trip.currency, myCurrency, rates), myCurrency)}
                        </p>
                        <p className="text-xs text-muted-foreground" data-testid="text-total-secondary">
                          {formatCurrency(settlement.total, trip.currency)}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm font-semibold text-foreground" data-testid="text-total">
                        {formatCurrency(settlement.total, trip.currency)}
                      </p>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-0.5">{trip.person1}</p>
                    {showNativeCurrency && rates ? (
                      <>
                        <p className="text-sm font-semibold text-foreground" data-testid="text-person1-paid">
                          {formatCurrency(convertAmount(settlement.person1Paid, trip.currency, myCurrency, rates), myCurrency)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(settlement.person1Paid, trip.currency)}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm font-semibold text-foreground" data-testid="text-person1-paid">
                        {formatCurrency(settlement.person1Paid, trip.currency)}
                      </p>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-0.5">{trip.person2}</p>
                    {showNativeCurrency && rates ? (
                      <>
                        <p className="text-sm font-semibold text-foreground" data-testid="text-person2-paid">
                          {formatCurrency(convertAmount(settlement.person2Paid, trip.currency, myCurrency, rates), myCurrency)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(settlement.person2Paid, trip.currency)}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm font-semibold text-foreground" data-testid="text-person2-paid">
                        {formatCurrency(settlement.person2Paid, trip.currency)}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            )}

            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-sm font-semibold text-foreground">
                Expenses {expenses && expenses.length > 0 && `(${expenses.length})`}
              </h2>
            </div>

            {expenses && expenses.length > 0 ? (
              <div className="space-y-2">
                {expenses.map((expense) => {
                  const person2Share = 100 - expense.person1Share;
                  const isDifferentCurrency = expense.currency !== trip.currency;
                  return (
                    <Card
                      key={expense.id}
                      className="p-3"
                      data-testid={`card-expense-${expense.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-md bg-accent flex-shrink-0 flex items-center justify-center mt-0.5">
                            <Receipt className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-foreground truncate" data-testid={`text-expense-desc-${expense.id}`}>
                                {expense.description}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <Badge variant="secondary" className="text-xs">
                                Paid by {expense.paidBy}
                              </Badge>
                              {isDifferentCurrency && (
                                <Badge variant="outline" className="text-xs">
                                  {expense.currency}
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {expense.person1Share === 50
                                  ? "50/50"
                                  : `${trip.person1} ${expense.person1Share}% / ${trip.person2} ${person2Share}%`}
                              </span>
                            </div>
                            {isDifferentCurrency && rates && (
                              <p className="text-xs text-muted-foreground mt-1" data-testid={`text-converted-${expense.id}`}>
                                {"\u2248"} {formatCurrency(convertAmount(expense.amount, expense.currency, trip.currency, rates), trip.currency)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-sm font-semibold text-foreground" data-testid={`text-expense-amount-${expense.id}`}>
                            {formatCurrency(expense.amount, expense.currency)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.preventDefault();
                              setDeleteExpenseId(expense.id);
                            }}
                            data-testid={`button-delete-expense-${expense.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="p-6 text-center">
                <div className="w-10 h-10 rounded-md bg-accent mx-auto mb-2 flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground" data-testid="text-no-expenses">
                  No expenses yet. Add your first one!
                </p>
              </Card>
            )}
          </>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t">
        <div className="max-w-lg mx-auto">
          <Button className="w-full" onClick={() => setShowAddExpense(true)} data-testid="button-add-expense">
            <Plus className="w-4 h-4 mr-1.5" />
            Add Expense
          </Button>
        </div>
      </div>

      {trip && (
        <AddExpenseDialog
          open={showAddExpense}
          onOpenChange={setShowAddExpense}
          trip={trip}
        />
      )}

      <AlertDialog open={!!deleteExpenseId} onOpenChange={() => setDeleteExpenseId(null)}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md rounded-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this expense? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteExpenseId && deleteExpense.mutate(deleteExpenseId)}
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
