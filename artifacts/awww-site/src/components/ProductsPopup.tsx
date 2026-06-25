import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShoppingCart, Calendar } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  useListProducts, 
  useGetCart, 
  useAddToCart, 
  useCreateBooking,
  getGetCartQueryKey,
  getListBookingsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface ProductsPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProductsPopup({ isOpen, onClose }: ProductsPopupProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: products = [], isLoading: loadingProducts } = useListProducts();
  const { data: cart } = useGetCart();
  
  const addToCart = useAddToCart();
  const createBooking = useCreateBooking();

  const [bookingFormId, setBookingFormId] = useState<number | null>(null);
  const [bookingDate, setBookingDate] = useState("");
  const [bookingNotes, setBookingNotes] = useState("");

  const shopItems = products.filter(p => p.type === "product");
  const serviceItems = products.filter(p => p.type === "service");

  const handleAddToCart = (productId: number) => {
    addToCart.mutate({ data: { productId, quantity: 1 } }, {
      onSuccess: () => {
        toast({ title: "Added to cart" });
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
      }
    });
  };

  const handleBookService = (serviceId: number) => {
    createBooking.mutate({ data: { serviceId, preferredDate: bookingDate, notes: bookingNotes } }, {
      onSuccess: () => {
        toast({ title: "Booking requested", description: "We will confirm your date soon." });
        setBookingFormId(null);
        setBookingDate("");
        setBookingNotes("");
        queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() });
      }
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="w-full max-w-3xl max-h-[85vh] flex flex-col bg-card border border-primary/30 rounded-xl shadow-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
            <h2 className="text-xl font-mono font-bold text-primary tracking-widest uppercase">Offerings</h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-destructive/20 hover:text-destructive">
              <X className="h-5 w-5" />
            </Button>
          </div>

          <Tabs defaultValue="shop" className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 pt-4 flex justify-between items-center">
              <TabsList className="bg-muted">
                <TabsTrigger value="shop" className="font-mono text-xs uppercase tracking-wider">Shop</TabsTrigger>
                <TabsTrigger value="services" className="font-mono text-xs uppercase tracking-wider">Services</TabsTrigger>
              </TabsList>
              
              <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full border border-border">
                <ShoppingCart className="h-4 w-4 text-primary" />
                <span>£{cart?.total?.toFixed(2) || "0.00"}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <TabsContent value="shop" className="mt-0 space-y-4">
                {loadingProducts ? (
                  <div className="text-center py-8 font-mono text-muted-foreground">Loading products...</div>
                ) : shopItems.length === 0 ? (
                  <div className="text-center py-8 font-mono text-muted-foreground">No products available at the moment.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {shopItems.map(item => (
                      <Card key={item.id} className="bg-background/50 border-primary/20 hover:border-primary/50 transition-colors">
                        <CardContent className="p-4 flex flex-col h-full">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-lg">{item.name}</h3>
                            <span className="font-mono text-primary font-bold">£{item.price.toFixed(2)}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-4 flex-1">{item.description}</p>
                          <Button 
                            onClick={() => handleAddToCart(item.id)}
                            className="w-full font-mono uppercase tracking-widest text-xs"
                            disabled={addToCart.isPending}
                          >
                            Add to Cart
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="services" className="mt-0 space-y-4">
                {loadingProducts ? (
                  <div className="text-center py-8 font-mono text-muted-foreground">Loading services...</div>
                ) : serviceItems.length === 0 ? (
                  <div className="text-center py-8 font-mono text-muted-foreground">No services available at the moment.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {serviceItems.map(item => (
                      <Card key={item.id} className="bg-background/50 border-primary/20 hover:border-primary/50 transition-colors">
                        <CardContent className="p-4 flex flex-col h-full">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-lg">{item.name}</h3>
                            <span className="font-mono text-primary font-bold">£{item.price.toFixed(2)}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-4 flex-1">{item.description}</p>
                          
                          {bookingFormId === item.id ? (
                            <div className="space-y-3 pt-3 border-t border-border mt-auto">
                              <Input 
                                type="date" 
                                value={bookingDate}
                                onChange={e => setBookingDate(e.target.value)}
                                className="bg-input font-mono text-sm"
                              />
                              <Textarea 
                                placeholder="Any specific requirements?"
                                value={bookingNotes}
                                onChange={e => setBookingNotes(e.target.value)}
                                className="bg-input font-mono text-sm resize-none h-20"
                              />
                              <div className="flex gap-2">
                                <Button 
                                  onClick={() => handleBookService(item.id)}
                                  className="flex-1 font-mono uppercase tracking-widest text-xs"
                                  disabled={createBooking.isPending}
                                >
                                  Confirm
                                </Button>
                                <Button 
                                  variant="outline" 
                                  onClick={() => setBookingFormId(null)}
                                  className="font-mono uppercase tracking-widest text-xs border-primary/30"
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button 
                              onClick={() => setBookingFormId(item.id)}
                              variant="outline"
                              className="w-full font-mono uppercase tracking-widest text-xs border-primary text-primary hover:bg-primary hover:text-primary-foreground mt-auto"
                            >
                              <Calendar className="h-4 w-4 mr-2" /> Book Service
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
