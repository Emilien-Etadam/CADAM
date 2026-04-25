import { useAuth } from '@/contexts/AuthContext';
import { type Profile } from '@shared/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const unavailable = 'Profiles are not available in this build.';

export function useProfile() {
  const { user } = useAuth();
  return useQuery<Profile | null>({
    queryKey: ['profile', user?.id, 'local'],
    enabled: false,
    queryFn: async () => null,
  });
}

export function useAvatarUrl(_avatarPath: string | null | undefined) {
  return useQuery({
    queryKey: ['avatar-url', 'local'],
    enabled: false,
    queryFn: async () => null,
  });
}

export function useUpdateProfile() {
  return useMutation({
    mutationFn: async (_p: Partial<Profile>) => {
      throw new Error(unavailable);
    },
  });
}

export function useUploadAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (_file: File) => {
      throw new Error(unavailable);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}
