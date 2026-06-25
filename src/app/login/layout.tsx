import { Suspense } from "react";
import LoginPage from "./page";

export default function Login() {
  return (
    <Suspense>
      <LoginPage />
    </Suspense>
  );
}
