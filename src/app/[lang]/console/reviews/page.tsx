import { Suspense } from "react";
import { ReviewQueue } from "@/components/console/ReviewQueue";

export default function Page() {
  return (
    <Suspense>
      <ReviewQueue />
    </Suspense>
  );
}
