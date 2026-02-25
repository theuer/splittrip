import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertExpenseSchema, type TripPublic, CURRENCIES } from "@shared/schema";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useState } from "react";

const formSchema = insertExpenseSchema.extend({
  description: z.string().min(1, "Description is required"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  person1Share: z.coerce.number().min(0).max(100),
  currency: z.string().min(1),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: TripPublic;
}

export function AddExpenseDialog({ open, onOpenChange, trip }: Props) {
  const { toast } = useToast();
  const [shareValue, setShareValue] = useState(50);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: "",
      amount: 0,
      paidBy: trip.person1,
      person1Share: 50,
      tripId: trip.id,
      currency: trip.currency,
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      let pin = "";
      try { pin = localStorage.getItem(`splittrip-pin-${trip.id}`) || ""; } catch {}
      await apiRequest("POST", "/api/expenses", values, pin ? { "x-trip-pin": pin } : undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", trip.id, "expenses"] });
      form.reset({
        description: "",
        amount: 0,
        paidBy: trip.person1,
        person1Share: 50,
        tripId: trip.id,
        currency: trip.currency,
      });
      setShareValue(50);
      onOpenChange(false);
      toast({ title: "Expense added!" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add expense", description: error.message, variant: "destructive" });
    },
  });

  const selectedCurrency = form.watch("currency");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md rounded-md">
        <DialogHeader>
          <DialogTitle>Add Expense</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What was it for?</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Dinner, Taxi, Museum" {...field} data-testid="input-expense-desc" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-[1fr,auto] gap-2">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        {...field}
                        data-testid="input-expense-amount"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-[100px]" data-testid="select-expense-currency">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c.code} value={c.code} data-testid={`select-expense-currency-${c.code}`}>
                            {c.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {selectedCurrency !== trip.currency && (
              <p className="text-xs text-muted-foreground">
                Will be converted to {trip.currency} for settlement using current exchange rates
              </p>
            )}

            <FormField
              control={form.control}
              name="paidBy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Who paid?</FormLabel>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={field.value === trip.person1 ? "default" : "outline"}
                      onClick={() => field.onChange(trip.person1)}
                      className="w-full"
                      data-testid="button-paid-person1"
                    >
                      {trip.person1}
                    </Button>
                    <Button
                      type="button"
                      variant={field.value === trip.person2 ? "default" : "outline"}
                      onClick={() => field.onChange(trip.person2)}
                      className="w-full"
                      data-testid="button-paid-person2"
                    >
                      {trip.person2}
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="person1Share"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Split</FormLabel>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">{trip.person1}: <span className="font-medium text-foreground">{shareValue}%</span></span>
                      <span className="text-muted-foreground">{trip.person2}: <span className="font-medium text-foreground">{100 - shareValue}%</span></span>
                    </div>
                    <Slider
                      min={0}
                      max={100}
                      step={5}
                      value={[shareValue]}
                      onValueChange={(vals) => {
                        setShareValue(vals[0]);
                        field.onChange(vals[0]);
                      }}
                      data-testid="slider-split"
                    />
                    <div className="flex items-center justify-center gap-2">
                      {[50, 100, 0].map((preset) => (
                        <Button
                          key={preset}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShareValue(preset);
                            field.onChange(preset);
                          }}
                          data-testid={`button-preset-${preset}`}
                        >
                          {preset === 50
                            ? "50/50"
                            : preset === 100
                              ? `${trip.person1} only`
                              : `${trip.person2} only`}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-submit-expense">
              {mutation.isPending ? "Adding..." : "Add Expense"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
