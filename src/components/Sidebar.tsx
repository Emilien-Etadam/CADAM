import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, Plus, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { apiListRecentConversations } from '@/services/localDataApi';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './ui/sheet';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useQuery } from '@tanstack/react-query';
import { cn, getInitials } from '@/lib/utils';
import { Conversation } from '@shared/types';

interface SidebarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
}

function UserBadge({ isSidebarOpen }: { isSidebarOpen: boolean }) {
  const { user } = useAuth();
  const label = user?.email?.split('@')[0] || 'User';
  const initials = getInitials(user?.email ?? null);
  if (!isSidebarOpen) {
    return (
      <div
        className="ml-[1px] flex h-[46px] w-[46px] items-center justify-center rounded-md border border-adam-neutral-700 bg-adam-neutral-950 text-xs font-medium text-adam-text-primary"
        title={user?.email ?? ''}
      >
        {initials || '?'}
      </div>
    );
  }
  return (
    <div className="rounded-md border border-adam-neutral-800 px-2 py-2">
      <p className="text-sm font-medium text-adam-text-primary">{label}</p>
      <p className="truncate text-xs text-adam-text-tertiary">{user?.email}</p>
    </div>
  );
}

function DesktopSidebar({ isSidebarOpen, setIsSidebarOpen }: SidebarProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const { data: recentConversations = [] } = useQuery<Conversation[]>({
    queryKey: ['conversations', 'recent'],
    initialData: [],
    queryFn: () => apiListRecentConversations(10),
  });

  const sidebarNavigate = (path: string) => {
    if (isMobile) {
      setIsSidebarOpen(false);
    }
    navigate(path);
  };

  return (
    <div
      className={cn(
        'hidden h-dvh flex-col border-r border-gray-200 bg-adam-bg-dark transition-all duration-300 ease-in-out dark:border-adam-border-primary md:flex',
        isSidebarOpen ? 'w-64' : 'w-20',
      )}
    >
      <div className="flex h-full flex-col">
        <div
          className={cn('flex border-b border-gray-200 p-2 dark:border-gray-800', {
            'justify-center': !isSidebarOpen,
            'px-2': isSidebarOpen,
          })}
        >
          {isSidebarOpen ? (
            <h1 className="text-sm font-bold text-adam-text-primary">CADAM</h1>
          ) : (
            <span className="text-sm font-bold text-adam-text-primary">C</span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-2">
          <Button
            variant="adam_dark"
            className="w-full justify-start gap-2"
            onClick={() => sidebarNavigate('/')}
          >
            <Plus className="h-4 w-4" />
            {isSidebarOpen && 'New chat'}
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-adam-text-primary"
            onClick={() => sidebarNavigate('/history')}
          >
            <LayoutGrid className="h-4 w-4" />
            {isSidebarOpen && 'History'}
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {isSidebarOpen && recentConversations.length > 0 && (
            <p className="mb-1 text-xs text-adam-text-tertiary">Recent</p>
          )}
          <ul className="space-y-1">
            {recentConversations.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/editor/${c.id}`}
                  className="line-clamp-1 block rounded p-1 text-xs text-adam-neutral-400 hover:bg-adam-neutral-950 hover:text-adam-neutral-10"
                >
                  {c.title || 'Untitled'}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className={cn('p-2', isSidebarOpen && 'px-3')}>
          <UserBadge isSidebarOpen={isSidebarOpen} />
        </div>
      </div>
    </div>
  );
}

function MobileSidebar() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="fixed left-2 top-2.5 z-50 hover:bg-adam-neutral-700 md:hidden"
        >
          <Menu className="h-5 w-5 text-adam-text-primary" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="bg-adam-bg-dark p-0 [&>button]:text-white"
      >
        <SheetHeader className="hidden">
          <SheetTitle className="text-adam-text-primary">CADAM</SheetTitle>
          <SheetDescription>Local parametric CAD</SheetDescription>
        </SheetHeader>
        <DesktopSidebar isSidebarOpen={true} setIsSidebarOpen={setOpen} />
      </SheetContent>
    </Sheet>
  );
}

export function Sidebar({ isSidebarOpen, setIsSidebarOpen }: SidebarProps) {
  const isMobile = useIsMobile();
  return isMobile ? (
    <MobileSidebar />
  ) : (
    <DesktopSidebar
      isSidebarOpen={isSidebarOpen}
      setIsSidebarOpen={setIsSidebarOpen}
    />
  );
}
