import clsx from 'clsx';
import { CheckCircle, Clock, Loader, XCircle } from 'lucide-react';

type Status = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

interface StatusBadgeProps {
  status: Status;
}

const statusConfig = {
  PENDING: {
    icon: Clock,
    label: 'Pending',
    className: 'bg-yellow-100 text-yellow-800',
  },
  PROCESSING: {
    icon: Loader,
    label: 'Processing',
    className: 'bg-blue-100 text-blue-800',
  },
  COMPLETED: {
    icon: CheckCircle,
    label: 'Completed',
    className: 'bg-green-100 text-green-800',
  },
  FAILED: {
    icon: XCircle,
    label: 'Failed',
    className: 'bg-red-100 text-red-800',
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        config.className
      )}
    >
      <Icon
        className={clsx(
          'w-3.5 h-3.5',
          status === 'PROCESSING' && 'animate-spin'
        )}
      />
      {config.label}
    </span>
  );
}
