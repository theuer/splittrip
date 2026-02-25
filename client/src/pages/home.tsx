import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { TripPublic } from "@shared/schema";
import { CURRENCIES } from "@shared/schema";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, MapPin, ChevronRight, Plane, Sun, Moon, Wallet, Lock } from "lucide-react";
import { useState } from "react";
import { CreateTripDialog } from "@/components/create-trip-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "@/components/theme-provider";
import { useMyCurrency } from "@/hooks/use-my-currency";

export default function Home() {
  const [showCreate, setShowCreate] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { myCurrency, setMyCurrency } = useMyCurrency();

  const { data: trips, isLoading } = useQuery<TripPublic[]>({
    queryKey: ["/api/trips"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/trips/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-primary flex items-center justify-center">
              <Plane className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground" data-testid="text-app-title">SplitTrip</h1>
              <p className="text-sm text-muted-foreground">Split expenses with your travel buddy</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={toggleTheme} data-testid="button-theme-toggle">
            {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </Button>
        </div>

        <Card className="p-3 mt-4 mb-4">
          <div className="flex items-center gap-3">
            <Wallet className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="flex items-center justify-between gap-2 flex-1 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">My Currency</p>
                <p className="text-xs text-muted-foreground">Settlements shown in your currency first</p>
              </div>
              <Select value={myCurrency || "none"} onValueChange={(v) => setMyCurrency(v === "none" ? "" : v)}>
                <SelectTrigger className="w-[120px]" data-testid="select-my-currency">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" data-testid="select-my-currency-none">Not set</SelectItem>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code} data-testid={`select-my-currency-${c.code}`}>
                      {c.code} ({c.symbol})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">Your Trips</h2>
          <Button onClick={() => setShowCreate(true)} data-testid="button-create-trip">
            <Plus className="w-4 h-4 mr-1.5" />
            New Trip
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-5 w-32 mb-2" />
                <Skeleton className="h-4 w-48" />
              </Card>
            ))}
          </div>
        ) : trips && trips.length > 0 ? (
          <div className="space-y-3">
            {trips.map((trip) => (
              <Link key={trip.id} href={`/trip/${trip.id}`}>
                <Card
                  className="p-4 hover-elevate active-elevate-2 cursor-pointer transition-colors"
                  data-testid={`card-trip-${trip.id}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-md bg-accent flex-shrink-0 flex items-center justify-center">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm text-foreground truncate" data-testid={`text-trip-name-${trip.id}`}>
                          {trip.name}
                        </h3>
                        <p className="text-xs text-muted-foreground truncate">
                          {trip.person1} & {trip.person2} &middot; {trip.currency}
                          {trip.hasPin && <Lock className="inline w-3 h-3 ml-1" />}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <div className="w-12 h-12 rounded-md bg-accent mx-auto mb-3 flex items-center justify-center">
              <Plane className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-1" data-testid="text-empty-state">No trips yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first trip to start tracking expenses
            </p>
            <Button onClick={() => setShowCreate(true)} data-testid="button-create-trip-empty">
              <Plus className="w-4 h-4 mr-1.5" />
              Create Trip
            </Button>
          </Card>
        )}
      </div>

      <CreateTripDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
}
