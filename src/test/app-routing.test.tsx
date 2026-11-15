import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it.each([
    ["/volunteer", "/volunteer/"],
    ["/volunteer/commitments", "/volunteer/commitments"],
    ["/volunteer/opportunities/r1", "/volunteer/opportunities/$requestId"],
    ["/volunteer/commitments/k1", "/volunteer/commitments_/$commitmentId"],
    ["/volunteer/profile", "/volunteer/profile"],
    ["/volunteer/preferences", "/volunteer/preferences"],
    ["/volunteer/rewards", "/volunteer/rewards"],
    ["/volunteer/verification", "/volunteer/verification"],
    ["/volunteer/login", "/volunteer/login"],
    ["/charity", "/charity/"],
    ["/charity/requests", "/charity/requests"],
    ["/charity/attendance", "/charity/attendance"],
    ["/charity/requests/r1/edit", "/charity/requests_/$requestId/edit"],
    ["/charity/create", "/charity/create"],
    ["/charity/profile", "/charity/profile"],
    ["/admin", "/admin/"],
    ["/admin/unfilled", "/admin/unfilled"],
  ])("opens the intended screen at %s", (path, routeId) => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes(path).at(-1)?.routeId).toBe(routeId);
  });
});
