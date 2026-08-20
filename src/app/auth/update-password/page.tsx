import { Suspense } from "react";
import UpdatePasswordClient from "./update-password-client";

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={null}>
      <UpdatePasswordClient />
    </Suspense>
  );
}
