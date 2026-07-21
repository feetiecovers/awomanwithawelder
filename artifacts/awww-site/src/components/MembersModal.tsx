import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, LogOut } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useLoginMember, 
  useRegisterMember, 
  useGetCurrentMember,
  useGetMemberBookings,
  useLogoutMember,
  getGetCurrentMemberQueryKey,
  getGetMemberBookingsQueryKey,
} from "@workspace/api-client-react";

interface MembersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MembersModal({ isOpen, onClose }: MembersModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: member, isLoading: isLoadingMember } = useGetCurrentMember();
  const { data: bookings = [], isLoading: isLoadingBookings } = useGetMemberBookings({
    query: { enabled: !!member, queryKey: getGetMemberBookingsQueryKey() }
  });
  
  const login = useLoginMember();
  const register = useRegisterMember();
  const logout = useLogoutMember();

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ name: "", email: "", password: "" });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate({ data: loginForm }, {
      onSuccess: () => {
        toast({ title: "Logged in successfully" });
        queryClient.invalidateQueries({ queryKey: getGetCurrentMemberQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMemberBookingsQueryKey() });
      },
      onError: () => {
        toast({ title: "Login failed", description: "Invalid credentials", variant: "destructive" });
      }
    });
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    register.mutate({ data: registerForm }, {
      onSuccess: () => {
        toast({ title: "Registered successfully", description: "You are now logged in." });
        queryClient.invalidateQueries({ queryKey: getGetCurrentMemberQueryKey() });
      },
      onError: () => {
        toast({ title: "Registration failed", variant: "destructive" });
      }
    });
  };

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        toast({ title: "Logged out" });
        queryClient.invalidateQueries({ queryKey: getGetCurrentMemberQueryKey() });
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
          className="w-full max-w-md flex flex-col bg-card border border-primary/30 rounded-xl shadow-2xl overflow-y-auto max-h-[calc(100dvh-32px)]"
        >
          <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
            <h2 className="text-xl font-mono font-bold text-primary tracking-widest uppercase">Members Area</h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-destructive/20 hover:text-destructive">
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="p-6">
            {isLoadingMember ? (
              <div className="py-8 text-center font-mono text-muted-foreground">Checking authentication...</div>
            ) : member ? (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-muted-foreground font-mono">Welcome back,</p>
                    <h3 className="text-2xl font-bold">{member.name}</h3>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleLogout} className="border-primary/30 text-primary hover:bg-primary/10">
                    <LogOut className="h-4 w-4 mr-2" /> Logout
                  </Button>
                </div>

                <div className="space-y-4">
                  <h4 className="font-mono text-sm uppercase tracking-widest text-primary border-b border-border pb-2">Your Bookings</h4>
                  {isLoadingBookings ? (
                    <div className="text-sm font-mono text-muted-foreground">Loading bookings...</div>
                  ) : bookings.length === 0 ? (
                    <div className="text-sm font-mono text-muted-foreground bg-muted/30 p-4 rounded-lg text-center border border-dashed border-border">
                      No bookings found. Head to the services tab to book one.
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                      {bookings.map((booking: any) => (
                        <div key={booking.id} className="p-3 bg-background/50 border border-primary/20 rounded-lg flex flex-col gap-2">
                          <div className="flex justify-between items-start">
                            <span className="font-bold">{booking.service?.name || 'Service'}</span>
                            <Badge variant="outline" className={
                              booking.status === 'confirmed' ? "border-green-500 text-green-500" :
                              booking.status === 'completed' ? "border-primary text-primary" :
                              booking.status === 'cancelled' ? "border-destructive text-destructive" :
                              "border-yellow-500 text-yellow-500"
                            }>
                              {booking.status}
                            </Badge>
                          </div>
                          {booking.preferredDate && (
                            <div className="text-xs font-mono text-muted-foreground">Date: {new Date(booking.preferredDate).toLocaleDateString()}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <Tabs defaultValue="login">
                <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted">
                  <TabsTrigger value="login" className="font-mono text-xs uppercase tracking-wider">Sign In</TabsTrigger>
                  <TabsTrigger value="register" className="font-mono text-xs uppercase tracking-wider">Register</TabsTrigger>
                </TabsList>
                
                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Input 
                        type="email" 
                        placeholder="Email Address" 
                        required
                        value={loginForm.email}
                        onChange={e => setLoginForm({...loginForm, email: e.target.value})}
                        className="bg-input font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <Input 
                        type="password" 
                        placeholder="Password" 
                        required
                        value={loginForm.password}
                        onChange={e => setLoginForm({...loginForm, password: e.target.value})}
                        className="bg-input font-mono"
                      />
                    </div>
                    <Button type="submit" className="w-full font-mono uppercase tracking-widest" disabled={login.isPending}>
                      {login.isPending ? "Signing in..." : "Sign In"}
                    </Button>
                  </form>
                </TabsContent>
                
                <TabsContent value="register">
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Input 
                        placeholder="Full Name" 
                        required
                        value={registerForm.name}
                        onChange={e => setRegisterForm({...registerForm, name: e.target.value})}
                        className="bg-input font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <Input 
                        type="email" 
                        placeholder="Email Address" 
                        required
                        value={registerForm.email}
                        onChange={e => setRegisterForm({...registerForm, email: e.target.value})}
                        className="bg-input font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <Input 
                        type="password" 
                        placeholder="Password" 
                        required
                        value={registerForm.password}
                        onChange={e => setRegisterForm({...registerForm, password: e.target.value})}
                        className="bg-input font-mono"
                      />
                    </div>
                    <Button type="submit" className="w-full font-mono uppercase tracking-widest" disabled={register.isPending}>
                      {register.isPending ? "Creating account..." : "Create Account"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
