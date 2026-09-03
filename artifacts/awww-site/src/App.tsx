import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import BookingConfirmation from "@/pages/BookingConfirmation";
import RequestQuote from "@/pages/RequestQuote";
import PasswordGate from "@/components/PasswordGate";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/booking-confirmation" component={BookingConfirmation} />
      <Route path="/request-quote" component={RequestQuote} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <PasswordGate>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <div className="dark">
              <Router />
            </div>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </PasswordGate>
  );
}

export default App;
