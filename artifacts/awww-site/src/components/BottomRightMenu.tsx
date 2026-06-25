import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSubmitContact } from "@workspace/api-client-react";
import { Send, Menu, MessageSquare, Briefcase, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface BottomRightMenuProps {
  onOpenMembers: () => void;
  onOpenProducts: () => void;
}

export function BottomRightMenu({ onOpenMembers, onOpenProducts }: BottomRightMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  
  const submitContact = useSubmitContact();
  const [contactForm, setContactForm] = useState({ name: "", email: "", phone: "", message: "" });
  
  const [chatMessage, setChatMessage] = useState("");
  const [messages, setMessages] = useState([
    { id: 1, sender: "bot", text: "Hi! How can I help you today?" }
  ]);

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitContact.mutate({ data: contactForm }, {
      onSuccess: () => {
        toast({ title: "Message sent", description: "We'll get back to you soon." });
        setContactForm({ name: "", email: "", phone: "", message: "" });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to send message.", variant: "destructive" });
      }
    });
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    
    setMessages([...messages, { id: Date.now(), sender: "user", text: chatMessage }]);
    setChatMessage("");
    
    // Simulate bot response
    setTimeout(() => {
      setMessages(prev => [...prev, { id: Date.now(), sender: "bot", text: "Thanks for reaching out! A representative will connect with you soon." }]);
    }, 1000);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="mb-4 w-80 sm:w-96 rounded-xl border border-primary/20 bg-card/95 backdrop-blur-md shadow-2xl overflow-hidden flex flex-col"
            style={{ maxHeight: "calc(100vh - 120px)" }}
          >
            <Tabs defaultValue="pages" className="w-full h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-3 rounded-none border-b border-border bg-transparent p-0">
                <TabsTrigger value="pages" className="rounded-none data-[state=active]:bg-primary/10 data-[state=active]:border-b-2 data-[state=active]:border-primary py-3">
                  <Menu className="h-4 w-4 mr-2" /> Pages
                </TabsTrigger>
                <TabsTrigger value="chat" className="rounded-none data-[state=active]:bg-primary/10 data-[state=active]:border-b-2 data-[state=active]:border-primary py-3">
                  <MessageSquare className="h-4 w-4 mr-2" /> Chat
                </TabsTrigger>
                <TabsTrigger value="contact" className="rounded-none data-[state=active]:bg-primary/10 data-[state=active]:border-b-2 data-[state=active]:border-primary py-3">
                  <FileText className="h-4 w-4 mr-2" /> Contact
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto min-h-[300px] max-h-[500px]">
                <TabsContent value="pages" className="p-4 space-y-2 mt-0">
                  <Button variant="ghost" className="w-full justify-start text-left font-mono" onClick={() => setIsOpen(false)}>Home</Button>
                  <Button variant="ghost" className="w-full justify-start text-left font-mono" onClick={() => { onOpenProducts(); setIsOpen(false); }}>Products & Services</Button>
                  <Button variant="ghost" className="w-full justify-start text-left font-mono" onClick={() => { onOpenProducts(); setIsOpen(false); }}>Book Now</Button>
                  <Button variant="ghost" className="w-full justify-start text-left font-mono" onClick={() => { onOpenMembers(); setIsOpen(false); }}>Members Area</Button>
                  <Button variant="ghost" className="w-full justify-start text-left font-mono" onClick={() => setIsOpen(false)}>About (Coming Soon)</Button>
                  <Button variant="ghost" className="w-full justify-start text-left font-mono" onClick={() => setIsOpen(false)}>Gallery (Coming Soon)</Button>
                </TabsContent>

                <TabsContent value="chat" className="flex flex-col h-full mt-0">
                  <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                    {messages.map(msg => (
                      <div key={msg.id} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`px-3 py-2 rounded-lg max-w-[80%] text-sm ${
                          msg.sender === "user" 
                            ? "bg-primary text-primary-foreground rounded-br-sm" 
                            : "bg-muted text-foreground rounded-bl-sm border border-border"
                        }`}>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 border-t border-border bg-background/50">
                    <form onSubmit={handleChatSubmit} className="flex gap-2">
                      <Input 
                        value={chatMessage} 
                        onChange={(e) => setChatMessage(e.target.value)} 
                        placeholder="Type a message..." 
                        className="bg-input/50 border-border font-mono text-xs"
                      />
                      <Button type="submit" size="icon" className="shrink-0 bg-primary hover:bg-primary/80">
                        <Send className="h-4 w-4" />
                      </Button>
                    </form>
                  </div>
                </TabsContent>

                <TabsContent value="contact" className="p-4 mt-0">
                  <form onSubmit={handleContactSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Input 
                        placeholder="Name" 
                        required 
                        value={contactForm.name}
                        onChange={(e) => setContactForm({...contactForm, name: e.target.value})}
                        className="bg-input/50 border-border font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Input 
                        type="email" 
                        placeholder="Email" 
                        required 
                        value={contactForm.email}
                        onChange={(e) => setContactForm({...contactForm, email: e.target.value})}
                        className="bg-input/50 border-border font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Input 
                        type="tel" 
                        placeholder="Phone (Optional)" 
                        value={contactForm.phone}
                        onChange={(e) => setContactForm({...contactForm, phone: e.target.value})}
                        className="bg-input/50 border-border font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Textarea 
                        placeholder="Message" 
                        required 
                        rows={4}
                        value={contactForm.message}
                        onChange={(e) => setContactForm({...contactForm, message: e.target.value})}
                        className="bg-input/50 border-border resize-none font-mono text-sm"
                      />
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full font-mono bg-primary text-primary-foreground hover:bg-primary/80 transition-all"
                      disabled={submitContact.isPending}
                    >
                      {submitContact.isPending ? "Sending..." : "Send Message"}
                    </Button>
                  </form>
                </TabsContent>
              </div>
            </Tabs>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-[0_0_20px_rgba(26,157,224,0.4)] text-primary-foreground border-2 border-primary-foreground/20 hover:shadow-[0_0_30px_rgba(26,157,224,0.6)] transition-all z-50"
      >
        <Briefcase className="h-6 w-6" />
      </motion.button>
    </div>
  );
}
