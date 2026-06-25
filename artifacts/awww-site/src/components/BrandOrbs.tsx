import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

const BRANDS = [
  { id: 1, name: "Brand 1", angle: 0, radius: 200, delay: 0 },
  { id: 2, name: "Brand 2", angle: 72, radius: 240, delay: 0.5 },
  { id: 3, name: "Brand 3", angle: 144, radius: 180, delay: 1.2 },
  { id: 4, name: "Brand 4", angle: 216, radius: 260, delay: 0.8 },
  { id: 5, name: "Brand 5", angle: 288, radius: 220, delay: 1.5 },
];

export function BrandOrbs() {
  const { toast } = useToast();

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {BRANDS.map((brand) => {
        // Calculate position based on angle and radius
        const rad = (brand.angle * Math.PI) / 180;
        const x = Math.cos(rad) * brand.radius;
        const y = Math.sin(rad) * brand.radius;

        return (
          <motion.div
            key={brand.id}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ 
              opacity: 1, 
              scale: 1,
              y: [y - 10, y + 10, y - 10],
              x: [x - 5, x + 5, x - 5]
            }}
            transition={{
              opacity: { duration: 1, delay: brand.delay },
              scale: { duration: 1, delay: brand.delay, type: "spring" },
              y: { duration: 4, repeat: Infinity, ease: "easeInOut", delay: brand.delay },
              x: { duration: 5, repeat: Infinity, ease: "easeInOut", delay: brand.delay * 1.5 }
            }}
            className="absolute pointer-events-auto cursor-pointer"
            style={{ 
              left: `calc(50% + ${x}px)`, 
              top: `calc(50% + ${y}px)`,
              x: "-50%",
              y: "-50%"
            }}
            onClick={() => {
              toast({
                title: `Coming soon: ${brand.name}`,
                description: "Partner brand integration in progress.",
              });
            }}
          >
            <motion.div 
              whileHover={{ scale: 1.2, boxShadow: "0 0 30px rgba(26, 157, 224, 0.8)" }}
              className="w-24 h-24 rounded-full bg-card/80 border border-primary/30 backdrop-blur-sm flex items-center justify-center shadow-[0_0_15px_rgba(26,157,224,0.3)] transition-colors hover:border-primary hover:bg-card"
            >
              <span className="font-mono text-xs text-primary font-bold tracking-widest uppercase">
                {brand.name}
              </span>
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}
