import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ensureCatalogLoaded } from "./storage/catalogOverridesStorage";

async function bootstrap() {
  await ensureCatalogLoaded();
  createRoot(document.getElementById("root")!).render(<App />);
}

void bootstrap();
