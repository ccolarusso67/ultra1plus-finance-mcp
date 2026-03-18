import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const [scheme, encoded] = authHeader.split(" ");
    if (scheme === "Basic" && encoded) {
      const decoded = atob(encoded);
      const [user, pass] = decoded.split(":");
      const validUser = process.env.DASHBOARD_USER || "admin";
      const validPass = process.env.DASHBOARD_PASS || "changeme";
      if (user === validUser && pass === validPass) {
        return NextResponse.next();
      }
    }
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Ultra1Plus Finance Dashboard"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
