import { AppShell } from "@/components/AppShell";
import { ComposerForm } from "@/components/ComposerForm";

export default function ComposerPage() {
  return (
    <AppShell active="/composer" title="Composer">
      <ComposerForm />
    </AppShell>
  );
}
