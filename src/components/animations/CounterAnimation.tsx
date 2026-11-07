import CountUp from 'react-countup';
import { useInView } from 'react-intersection-observer';
import { motion } from 'framer-motion';

interface CounterAnimationProps {
  end: number;
  start?: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  separator?: string;
  className?: string;
}

const CounterAnimation: React.FC<CounterAnimationProps> = ({
  end,
  start = 0,
  duration = 2.5,
  decimals = 0,
  prefix = '',
  suffix = '',
  separator = ',',
  className = ''
}) => {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.3
  });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={inView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.5, type: "spring" }}
      className={className}
    >
      {inView && (
        <CountUp
          start={start}
          end={end}
          duration={duration}
          decimals={decimals}
          prefix={prefix}
          suffix={suffix}
          separator={separator}
        />
      )}
    </motion.div>
  );
};

export default CounterAnimation;
