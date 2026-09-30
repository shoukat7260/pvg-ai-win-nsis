import { AppProviders } from "./providers";
import { AppRouter } from "./router";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { ToastHost } from "@/components/ToastHost";

export function App() {
  return (
    <AppErrorBoundary>
      <AppProviders>
        <AppRouter />
        <ToastHost />
      </AppProviders>
    </AppErrorBoundary>
  );
}
