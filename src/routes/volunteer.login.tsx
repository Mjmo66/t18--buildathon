import { createFileRoute } from "@tanstack/react-router";
import { LoginScreen } from "@/features/volunteer/login-screen";
import { pageHead, RouteError, Missing } from "@/components/shared/common";
export const Route = createFileRoute("/volunteer/login")({
  head: () => pageHead("Sign in", "Sign in to Kindred as a volunteer."),
  component: LoginScreen,
  errorComponent: RouteError,
  notFoundComponent: Missing,
});
