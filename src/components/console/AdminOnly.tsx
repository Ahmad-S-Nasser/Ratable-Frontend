"use client";

import type { ReactNode } from "react";
import { useConsole } from "./context";
import { Card } from "./ui";

/** Admin pages show nothing but a notice to a moderator who opens the address by hand. The API refuses them as well. */
export function AdminOnly({ children }: { children: ReactNode }) {
  const { isAdmin, t } = useConsole();
  if (isAdmin) return <>{children}</>;
  return (
    <Card className="max-w-md space-y-2">
      <h1 className="font-heading text-xl font-semibold">{t("signin.noAccessHeading")}</h1>
      <p className="text-muted">{t("signin.noAccess")}</p>
    </Card>
  );
}
