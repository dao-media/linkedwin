import { AppShell } from "@/components/AppShell";
import { TrendsView } from "@/components/TrendsView";
import { getTrendsDashboard } from "@/lib/trends";

export default async function TrendsPage() {
  const data = await getTrendsDashboard();

  return (
    <AppShell active="/trends" title="Trends">
      <TrendsView data={data} />
    </AppShell>
  );
}
