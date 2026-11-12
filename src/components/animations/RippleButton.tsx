import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface RippleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  rippleColor?: string;
}

interface Ripple {
  x: number;
  y: number;
  size: number;
  id: number;
}

const RippleButton = React.forwardRef<HTMLButtonElement, RippleButtonProps>(
  ({ children, className, rippleColor = 'rgba(255, 255, 255, 0.6)', onClick, ...props }, ref) => {
    const [ripples, setRipples] = useState<Ripple[]>([]);
    const buttonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
      if (ripples.length > 0) {
        const timeout = setTimeout(() => {
          setRipples((prevRipples) => prevRipples.slice(1));
        }, 600);
        return () => clearTimeout(timeout);
      }
    }, [ripples]);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      const button = buttonRef.current;
      if (!button) return;

      const rect = button.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;

      const newRipple: Ripple = {
        x,
        y,
        size,
        id: Date.now()
      };

      setRipples((prevRipples) => [...prevRipples, newRipple]);

      if (onClick) {
        onClick(e);
      }
    };

    return (
      <motion.button
        ref={(node) => {
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
          // @ts-ignore
          buttonRef.current = node;
        }}
        className={cn('relative overflow-hidden', className)}
        onClick={handleClick}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.1 }}
        {...(props as any)}
      >
        {children}
        {ripples.map((ripple) => (
          <motion.span
            key={ripple.id}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: ripple.x,
              top: ripple.y,
              width: ripple.size,
              height: ripple.size,
              background: rippleColor,
            }}
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 2, opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        ))}
      </motion.button>
    );
  }
);

RippleButton.displayName = 'RippleButton';

export default RippleButton;
