import { Suspense } from "react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/40 p-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-primary">OpenShip</h1>
        <p className="text-sm text-muted-foreground">AI-Powered Project Management, Simplified.</p>
      </div>
      <Suspense>{children}</Suspense>
    </main>
  );
}
