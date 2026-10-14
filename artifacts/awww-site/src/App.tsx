import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import BookingConfirmation from "@/pages/BookingConfirmation";
import RequestQuote from "@/pages/RequestQuote";
import AboutMe from "@/pages/AboutMe";
import DenverDeskAnalyticsConsent from "@/components/DenverDeskAnalyticsConsent";

import { getListProductsQueryKey } from "@workspace/api-client-react";
import { getCachedProducts } from "@/lib/productsCache";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
    },
  },
});

// Pre-seed query cache immediately so offerings are instantly visible
const initialProducts = getCachedProducts();
if (initialProducts && initialProducts.length > 0) {
  queryClient.setQueryData(getListProductsQueryKey(), initialProducts);
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/booking-confirmation" component={BookingConfirmation} />
      <Route path="/request-quote" component={RequestQuote} />
      <Route path="/about" component={AboutMe} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <div className="dark">
            <Router />
          </div>
          <DenverDeskAnalyticsConsent />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

