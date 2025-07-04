import { motion } from "framer-motion";

function AnimateableBlock({ 
  children, 
  delay = 0, 
  shouldAnimate = true 
}: { 
  children: React.ReactNode, 
  delay: number,
  shouldAnimate?: boolean 
}) {
  if (!shouldAnimate) {
    return <div>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: -50, filter: "blur(4px)" }}
      transition={{
        duration: 0.4,
        delay: delay / 1000, // Convert ms to seconds
        ease: "easeInOut"
      }}
    >
      {children}
    </motion.div>
  );
}

export default AnimateableBlock;