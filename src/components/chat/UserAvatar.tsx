import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { getInitials } from '@/lib/utils';

export function UserAvatar({ className }: { className?: string }) {
  const { user } = useAuth();
  return (
    <Avatar className={className}>
      <AvatarFallback>
        {getInitials((user?.email || 'User').split('@')[0] ?? 'U')}
      </AvatarFallback>
    </Avatar>
  );
}
