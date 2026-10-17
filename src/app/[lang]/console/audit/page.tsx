import { AuditLog } from "@/components/console/AdminPages";
import { AdminOnly } from "@/components/console/AdminOnly";

export default function Page() {
  return (
    <AdminOnly>
      <AuditLog />
    </AdminOnly>
  );
}
