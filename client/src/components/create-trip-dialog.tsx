import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTripSchema, CURRENCIES } from "@shared/schema";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useLocation } from "wouter";
import { Lock } from "lucide-react";

const formSchema = insertTripSchema.extend({
  name: z.string().min(1, "Trip name is required"),
  person1: z.string().min(1, "Name is required"),
  person2: z.string().min(1, "Name is required"),
  pin: z.string().regex(/^\d{4}$/, "PIN must be 4 digits").optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTripDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      person1: "",
      person2: "",
      currency: "EUR",
      pin: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const res = await apiRequest("POST", "/api/trips", values);
      return res.json();
    },
    onSuccess: (trip) => {
      const pin = form.getValues("pin");
      if (pin && trip.hasPin) {
        try {
          localStorage.setItem(`splittrip-pin-${trip.id}`, pin);
        } catch {}
      }
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      form.reset();
      onOpenChange(false);
      navigate(`/trip/${trip.id}`);
      toast({ title: "Trip created!" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create trip", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md rounded-md">
        <DialogHeader>
          <DialogTitle>New Trip</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trip Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Barcelona Weekend" {...field} data-testid="input-trip-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="person1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Person 1</FormLabel>
                    <FormControl>
                      <Input placeholder="Your name" {...field} data-testid="input-person1" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="person2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Person 2</FormLabel>
                    <FormControl>
                      <Input placeholder="Friend's name" {...field} data-testid="input-person2" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Base Currency</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-currency">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c.code} value={c.code} data-testid={`select-currency-${c.code}`}>
                          {c.code} - {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Settlement will be shown in this currency</p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="pin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    PIN Protection
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="\d{4}"
                      maxLength={4}
                      placeholder="Optional 4-digit PIN"
                      {...field}
                      data-testid="input-trip-pin"
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground mt-1">Leave empty for no protection</p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-submit-trip">
              {mutation.isPending ? "Creating..." : "Create Trip"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
