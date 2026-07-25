import { AppShell } from "@/components/AppShell";
import { TrendsView } from "@/components/TrendsView";
import { getTrendsDashboard } from "@/lib/trends";

export default async function DataPage() {
  const data = await getTrendsDashboard();

  return (
    <AppShell active="/data" title="Data">
      <TrendsView data={data} />
    </AppShell>
  );
}
