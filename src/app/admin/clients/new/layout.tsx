import { Suspense } from "react";
import NewClientPage from "./page";

export default function NewClient() {
  return (
    <Suspense>
      <NewClientPage />
    </Suspense>
  );
}
