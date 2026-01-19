import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

export interface ModernCardProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  variant?: 'default' | 'gradient' | 'bordered' | 'glass' | 'stat';
  hoverEffect?: 'lift' | 'glow' | 'scale' | 'none';
  animateOnMount?: boolean;
  accentColor?: string;
  onClick?: () => void;
}

export const ModernCard: React.FC<ModernCardProps> = ({
  title,
  description,
  icon: Icon,
  iconColor = 'text-primary',
  iconBgColor = 'bg-primary/10',
  children,
  footer,
  className,
  variant = 'default',
  hoverEffect = 'lift',
  animateOnMount = true,
  accentColor,
  onClick,
}) => {
  const variantStyles = {
    default: 'bg-white border border-gray-200 shadow-sm',
    gradient: 'bg-gradient-to-br from-white via-purple-50/30 to-pink-50/30 border border-purple-100/50 shadow-md',
    bordered: 'bg-white border-2 border-primary/20 shadow-sm',
    glass: 'bg-white/70 backdrop-blur-md border border-white/50 shadow-lg',
    stat: 'bg-white border-l-4 shadow-md',
  };

  const hoverEffectStyles = {
    lift: 'hover:shadow-xl hover:-translate-y-1',
    glow: 'hover:shadow-[0_0_30px_rgba(155,89,182,0.3)] hover:border-primary/30',
    scale: 'hover:scale-[1.02]',
    none: '',
  };

  return (
    <Card
      className={cn(
        'relative overflow-hidden rounded-xl transition-all duration-300 ease-out',
        variantStyles[variant],
        hoverEffectStyles[hoverEffect],
        animateOnMount && 'animate-fade-in',
        onClick && 'cursor-pointer',
        className
      )}
      style={{
        borderLeftColor: variant === 'stat' && accentColor ? accentColor : undefined,
      }}
      onClick={onClick}
    >
      {/* Animated gradient overlay on hover */}
      {variant === 'gradient' && (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-pink-500/5 opacity-0 hover:opacity-100 transition-opacity duration-500" />
      )}

      {/* Subtle animated background pattern */}
      {variant !== 'glass' && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/5 to-transparent rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 -z-10" />
      )}

      <CardHeader className="relative z-10">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-1.5">
            {title && (
              <CardTitle className="text-lg sm:text-xl font-semibold text-gray-900 transition-colors duration-200 group-hover:text-primary">
                {title}
              </CardTitle>
            )}
            {description && (
              <CardDescription className="text-sm text-gray-600">
                {description}
              </CardDescription>
            )}
          </div>

          {Icon && (
            <div
              className={cn(
                'flex items-center justify-center w-12 h-12 rounded-xl',
                'transition-all duration-300 ease-out',
                'group-hover:scale-110 group-hover:rotate-3',
                iconBgColor,
                iconColor
              )}
            >
              <Icon className="w-6 h-6" />
            </div>
          )}
        </div>
      </CardHeader>

      {children && (
        <CardContent className="relative z-10 pb-6">
          {children}
        </CardContent>
      )}

      {footer && (
        <CardFooter className="relative z-10 pt-0">
          {footer}
        </CardFooter>
      )}

      {/* Shimmer effect on hover */}
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
    </Card>
  );
};

// Stat Card variant with large numbers
export interface StatCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
  trend?: {
    value: number;
    label?: string;
  };
  accentColor?: string;
  className?: string;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  iconColor = 'text-primary',
  iconBgColor = 'bg-primary/10',
  trend,
  accentColor = '#9B59B6',
  className,
  onClick,
}) => {
  const isPositiveTrend = trend && trend.value > 0;
  const isNegativeTrend = trend && trend.value < 0;

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl bg-white',
        'border-l-4 shadow-md transition-all duration-300 ease-out',
        'hover:shadow-xl hover:-translate-y-1',
        'animate-fade-in',
        onClick && 'cursor-pointer',
        className
      )}
      style={{ borderLeftColor: accentColor }}
      onClick={onClick}
    >
      {/* Animated background gradient */}
      <div
        className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 group-hover:opacity-30 transition-opacity duration-500"
        style={{ background: accentColor }}
      />

      <div className="relative z-10 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            <p className="text-3xl font-bold text-gray-900 transition-transform duration-300 group-hover:scale-105">
              {value}
            </p>
          </div>

          {Icon && (
            <div
              className={cn(
                'flex items-center justify-center w-14 h-14 rounded-xl',
                'transition-all duration-300 ease-out',
                'group-hover:scale-110 group-hover:rotate-6',
                iconBgColor,
                iconColor
              )}
            >
              <Icon className="w-7 h-7" />
            </div>
          )}
        </div>

        {trend && (
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1 text-sm font-semibold px-2 py-1 rounded-full',
                isPositiveTrend && 'bg-green-100 text-green-700',
                isNegativeTrend && 'bg-red-100 text-red-700',
                !isPositiveTrend && !isNegativeTrend && 'bg-gray-100 text-gray-700'
              )}
            >
              {isPositiveTrend && '↑'}
              {isNegativeTrend && '↓'}
              {Math.abs(trend.value)}%
            </span>
            {trend.label && (
              <span className="text-sm text-gray-500">{trend.label}</span>
            )}
          </div>
        )}
      </div>

      {/* Shimmer effect */}
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />
    </div>
  );
};

// Action Card with prominent CTA
export interface ActionCardProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  actionLabel: string;
  onAction: () => void;
  variant?: 'primary' | 'secondary' | 'gradient';
  className?: string;
}

export const ActionCard: React.FC<ActionCardProps> = ({
  title,
  description,
  icon: Icon,
  actionLabel,
  onAction,
  variant = 'primary',
  className,
}) => {
  const variantStyles = {
    primary: 'bg-gradient-to-br from-primary to-purple-600 text-white',
    secondary: 'bg-gradient-to-br from-gray-700 to-gray-900 text-white',
    gradient: 'bg-gradient-to-br from-orange-400 via-pink-500 to-purple-600 text-white',
  };

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl p-6',
        'shadow-lg transition-all duration-300 ease-out',
        'hover:shadow-2xl hover:scale-[1.02]',
        'animate-fade-in',
        variantStyles[variant],
        className
      )}
    >
      {/* Animated circles */}
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
      <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />

      <div className="relative z-10">
        {Icon && (
          <div className="mb-4 inline-flex p-3 bg-white/20 rounded-xl backdrop-blur-sm group-hover:scale-110 transition-transform duration-300">
            <Icon className="w-8 h-8" />
          </div>
        )}

        <h3 className="text-xl font-bold mb-2">{title}</h3>
        <p className="text-white/90 mb-6">{description}</p>

        <button
          onClick={onAction}
          className={cn(
            'px-6 py-3 rounded-xl font-semibold',
            'bg-white text-gray-900',
            'hover:bg-white/90 active:scale-95',
            'transition-all duration-200',
            'shadow-lg hover:shadow-xl'
          )}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
};
