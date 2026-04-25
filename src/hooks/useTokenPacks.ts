import { useQuery } from '@tanstack/react-query';
import type { BillingProduct } from '@/hooks/useBillingProducts';

export function useTokenPacks() {
  return useQuery<BillingProduct[]>({
    queryKey: ['billing', 'products', 'pack', 'local'],
    enabled: false,
    queryFn: async () => [],
  });
}
