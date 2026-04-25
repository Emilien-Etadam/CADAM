import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';

const billingError = 'Billing is not available in this build.';

type CheckoutResponse = { url: string };

export const useSubscriptionService = () => {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (_args: {
      priceId: string;
      trialPeriodDays?: number;
      source: string;
    }): Promise<CheckoutResponse> => {
      throw new Error(billingError);
    },
    onError: () => {
      toast({
        title: 'Unavailable',
        description: billingError,
        variant: 'destructive',
      });
    },
  });
};

export const useTokenPackPurchase = () => {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async () => {
      throw new Error(billingError);
    },
    onError: () => {
      toast({ title: 'Unavailable', description: billingError, variant: 'destructive' });
    },
  });
};

export const useManageSubscription = () => {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async () => {
      throw new Error(billingError);
    },
    onError: () => {
      toast({ title: 'Unavailable', description: billingError, variant: 'destructive' });
    },
  });
};
