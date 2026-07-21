import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";
import { getConfiguredApiBaseUrl } from "@/lib/api-base";

setBaseUrl(getConfiguredApiBaseUrl() || null);

createRoot(document.getElementById("root")!).render(<App />);
