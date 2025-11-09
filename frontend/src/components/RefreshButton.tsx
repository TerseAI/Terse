import type { ComponentProps } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

type RefreshButtonProps = Omit<ComponentProps<typeof Button>, 'children'> & {
    isRefreshing?: boolean;
    label?: string;
};

export function RefreshButton({
    isRefreshing = false,
    label = 'Refresh',
    className,
    disabled,
    title = 'Refresh list',
    variant = 'ghost',
    size = 'sm',
    ...props
}: RefreshButtonProps) {
    return (
        <Button
            variant={variant}
            size={size}
            title={title}
            disabled={disabled ?? isRefreshing}
            className={cn('flex items-center', className)}
            {...props}
        >
            <RefreshCw className={cn('mr-1 h-3 w-3', isRefreshing && 'animate-spin')} />
            {label}
        </Button>
    );
}


