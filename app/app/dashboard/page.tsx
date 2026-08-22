import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { DashboardClient } from "./_components/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);

  const orgName = activeOrg?.name || "Centro do Sorriso";

  return (
    <div className="flex h-full flex-col gap-6">
      <DashboardClient orgName={orgName} />
    </div>
  );
}
