import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSubmitContact } from "@workspace/api-client-react";
import { Send, Menu, MessageSquare, MousePointer2, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import StreamChatWidget from "./StreamChatWidget";
import { getConfiguredApiBaseUrl } from "@/lib/api-base";



interface BottomRightMenuProps {
  onOpenMembers: () => void;
  onOpenProducts: () => void;
}

export function BottomRightMenu({ onOpenMembers, onOpenProducts }: BottomRightMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeMenuTab, setActiveMenuTab] = useState("pages");
  const [hasUnreadChat, setHasUnreadChat] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && activeMenuTab === "chat") {
      setHasUnreadChat(false);
    }
  }, [isOpen, activeMenuTab]);
  
  const submitContact = useSubmitContact();
  const [contactForm, setContactForm] = useState({ name: "", email: "", phone: "", message: "" });
  
  const [visitorId, setVisitorId] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [operatorCount, setOperatorCount] = useState<number | null>(null);

  const apiBaseUrl = getConfiguredApiBaseUrl();

  // Initialize unique session visitor ID
  useEffect(() => {
    let id = localStorage.getItem('awww_chat_visitor_id');
    if (!id) {
      id = `visitor_${Math.random().toString(36).substring(2, 11)}`;
      localStorage.setItem('awww_chat_visitor_id', id);
    }
    setVisitorId(id);
  }, []);

  // Load chat messages from the desktop application
  const fetchMessages = async () => {
    if (!visitorId) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/chat?chatId=${encodeURIComponent(visitorId)}`);
      if (res.ok) {
        const data = await res.json();
        const newMessages = data.messages || [];
        const newOpCount = newMessages.filter((m: any) => m.sender === 'operator').length;
        
        setOperatorCount(prevCount => {
          if (prevCount !== null && newOpCount > prevCount) {
            // Only notify if not currently looking at the chat tab
            setIsOpen(currentOpen => {
              setActiveMenuTab(currentTab => {
                if (!currentOpen || currentTab !== "chat") {
                  setHasUnreadChat(true);
                }
                return currentTab;
              });
              return currentOpen;
            });
          }
          return newOpCount;
        });

        setMessages(newMessages);
        setError(null);
      } else {
        throw new Error('API error');
      }
    } catch (err) {
      console.warn("Chat service offline:", err);
      setError('Chat offline. Please ensure desktop app is running.');
    }
  };

  // Poll chat endpoint every 3 seconds for new messages
  useEffect(() => {
    if (!visitorId) return;
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [visitorId]);

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

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="mb-3 w-[calc(100vw-32px)] sm:w-80 md:w-96 rounded-[24px] border border-primary/30 bg-[#080d14] shadow-[0_0_60px_rgba(26,157,224,0.18),0_8px_40px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col"
            style={{ maxHeight: "calc(100dvh - 110px)" }}
          >
            <Tabs value={activeMenuTab} onValueChange={setActiveMenuTab} className="w-full h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-3 rounded-none bg-[#080d14] p-0 flex-shrink-0 h-auto border-b border-primary/20">
                <TabsTrigger value="pages" className="rounded-none border-b-2 border-transparent data-[state=active]:bg-primary/10 data-[state=active]:border-primary py-3">
                  <Menu className="h-4 w-4 mr-2" /> Pages
                </TabsTrigger>
                <TabsTrigger value="chat" className="rounded-none border-b-2 border-transparent data-[state=active]:bg-primary/10 data-[state=active]:border-primary py-3 relative">
                  <MessageSquare className="h-4 w-4 mr-2" /> Chat
                  {hasUnreadChat && (
                    <span className="absolute top-2.5 right-4.5 w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(26,157,224,0.9)]" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="contact" className="rounded-none border-b-2 border-transparent data-[state=active]:bg-primary/10 data-[state=active]:border-primary py-3">
                  <FileText className="h-4 w-4 mr-2" /> Contact
                </TabsTrigger>
              </TabsList>

              <div className={`flex-1 ${activeMenuTab !== "chat" ? "overflow-y-auto" : "overflow-hidden"} min-h-[500px] max-h-[620px] flex flex-col`}>
                <TabsContent value="pages" className="p-4 space-y-2 mt-0">
                  <Button variant="ghost" className="w-full justify-start text-left font-mono" onClick={() => setIsOpen(false)}>Home</Button>
                  <Button variant="ghost" className="w-full justify-start text-left font-mono" onClick={() => { onOpenProducts(); setIsOpen(false); }}>Products & Services</Button>
                  <Button variant="ghost" className="w-full justify-start text-left font-mono" onClick={() => { onOpenProducts(); setIsOpen(false); }}>Book Now</Button>
                  <Button variant="ghost" className="w-full justify-start text-left font-mono" onClick={() => setIsOpen(false)}>About (Coming Soon)</Button>
                  <Button variant="ghost" className="w-full justify-start text-left font-mono" onClick={() => setIsOpen(false)}>Gallery (Coming Soon)</Button>
                </TabsContent>

                <TabsContent value="chat" className="flex-1 flex flex-col h-full mt-0 overflow-hidden bg-[#080d14]">
                  <StreamChatWidget
                    visitorId={visitorId}
                    messages={messages}
                    error={error}
                    apiBaseUrl={apiBaseUrl}
                    onRefetch={fetchMessages}
                  />
                </TabsContent>

                <TabsContent value="contact" className="p-4 mt-0 overflow-y-auto">
                  <p className="text-xs font-mono text-center text-primary/80 mb-4 tracking-wide">
                    Email us directly at:<br />
                    <a href="mailto:charlotte@awomanwithawelder.co.nz" className="text-primary hover:underline font-bold">charlotte@awomanwithawelder.co.nz</a>
                  </p>
                  <form onSubmit={handleContactSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Input 
                        placeholder="Name" 
                        required 
                        value={contactForm.name}
                        onChange={(e) => setContactForm({...contactForm, name: e.target.value})}
                        className="bg-primary/5 border-primary/20 focus:border-primary/50 font-mono text-sm h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Input 
                        type="email" 
                        placeholder="Email" 
                        required 
                        value={contactForm.email}
                        onChange={(e) => setContactForm({...contactForm, email: e.target.value})}
                        className="bg-primary/5 border-primary/20 focus:border-primary/50 font-mono text-sm h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Input 
                        type="tel" 
                        placeholder="Phone (Optional)" 
                        value={contactForm.phone}
                        onChange={(e) => setContactForm({...contactForm, phone: e.target.value})}
                        className="bg-primary/5 border-primary/20 focus:border-primary/50 font-mono text-sm h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Textarea 
                        placeholder="Message" 
                        required 
                        rows={4}
                        value={contactForm.message}
                        onChange={(e) => setContactForm({...contactForm, message: e.target.value})}
                        className="bg-primary/5 border-primary/20 focus:border-primary/50 resize-none font-mono text-sm"
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

      <div className="relative">
        {hasUnreadChat && (
          <span className="absolute inset-0 rounded-full border-2 border-primary animate-ping pointer-events-none" />
        )}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(!isOpen)}
          className={`w-14 h-14 rounded-full bg-primary flex items-center justify-center text-primary-foreground border-2 border-primary-foreground/20 transition-all z-50 relative ${
            hasUnreadChat
              ? "shadow-[0_0_25px_rgba(26,157,224,0.85)] border-primary-foreground"
              : "shadow-[0_0_20px_rgba(26,157,224,0.4)] hover:shadow-[0_0_30px_rgba(26,157,224,0.6)]"
          }`}
        >
          {hasUnreadChat ? (
            <MessageSquare className="h-6 w-6 animate-pulse text-white" />
          ) : (
            <MousePointer2 className="h-6 w-6" />
          )}
        </motion.button>
      </div>
    </div>
  );
}
