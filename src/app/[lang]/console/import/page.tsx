import { AdminOnly } from "@/components/console/AdminOnly";
import { SeedImport } from "@/components/console/SeedImport";

export default function Page() {
  return (
    <AdminOnly>
      <SeedImport />
    </AdminOnly>
  );
}
