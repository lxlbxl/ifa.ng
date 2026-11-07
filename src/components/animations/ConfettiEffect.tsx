import { useEffect } from 'react';
import confetti from 'canvas-confetti';

interface ConfettiEffectProps {
  trigger: boolean;
  onComplete?: () => void;
}

export const useConfetti = () => {
  const fireConfetti = () => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min;
    };

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors: ['#F97316', '#EC4899', '#8B5CF6', '#3B82F6', '#10B981']
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors: ['#F97316', '#EC4899', '#8B5CF6', '#3B82F6', '#10B981']
      });
    }, 250);
  };

  const fireSuccess = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#10B981', '#34D399', '#6EE7B7']
    });
  };

  const fireCelebration = () => {
    const count = 200;
    const defaults = {
      origin: { y: 0.7 },
      zIndex: 9999
    };

    const fire = (particleRatio: number, opts: any) => {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
        colors: ['#F97316', '#EC4899', '#8B5CF6', '#F59E0B', '#10B981']
      });
    };

    fire(0.25, {
      spread: 26,
      startVelocity: 55,
    });
    fire(0.2, {
      spread: 60,
    });
    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 45,
    });
  };

  return { fireConfetti, fireSuccess, fireCelebration };
};

const ConfettiEffect: React.FC<ConfettiEffectProps> = ({ trigger, onComplete }) => {
  const { fireConfetti } = useConfetti();

  useEffect(() => {
    if (trigger) {
      fireConfetti();
      if (onComplete) {
        setTimeout(onComplete, 3000);
      }
    }
  }, [trigger]);

  return null;
};

export default ConfettiEffect;
