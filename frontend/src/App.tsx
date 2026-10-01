import { FormEvent, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TasksPage } from "./features/tasks/pages/TasksPage";
import { OrganizationsPage } from "./features/organizations/pages/OrganizationsPage";
import { request, Session } from "./api/client";

const client = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});
export default function App() {
  const [session, setSession] = useState<Session | null>(null),
    [organization, setOrganization] = useState("");
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [signingIn, setSigningIn] = useState(false);
  const [registering, setRegistering] = useState(false),
    [name, setName] = useState(""),
    [teamName, setTeamName] = useState("");
  const [guard, setGuard] = useState({ dirty: false, busy: false });
  const mayLeave = () =>
    !guard.busy &&
    (!guard.dirty ||
      confirm(
        "Discard unsaved project, task, or comment changes? Export the drafts first to keep them.",
      ));
  async function login(event: FormEvent) {
    event.preventDefault();
    if (signingIn) return;
    setSigningIn(true);
    setError("");
    try {
      const result = await request<Session>(
        registering ? "/auth/register" : "/auth/login",
        null,
        {
          method: "POST",
          body: JSON.stringify(
            registering
              ? { email, password, name, teamName }
              : { email, password },
          ),
        },
      );
      client.clear();
      setSession(result);
      setOrganization(result.user.memberships[0]?.organization.id || "");
      setPassword("");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Sign-in failed.");
    } finally {
      setSigningIn(false);
    }
  }
  return (
    <QueryClientProvider client={client}>
      <main>
        <header className="hero">
          <p className="eyebrow">TEAM WORKSPACE</p>
          <h1>Make the next step clear.</h1>
          <p>Give work a home, an owner, and a useful conversation.</p>
        </header>
        {!session ? (
          <section className="panel login-panel">
            <h2>
              {registering
                ? "Create your first team"
                : "Sign in to your workspace"}
            </h2>
            <p>
              Use a fictional demo account, or create an account with its own
              private team.
            </p>
            <form onSubmit={login}>
              {registering && (
                <>
                  <label>
                    Your name
                    <input
                      required
                      maxLength={120}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <label>
                    Team name
                    <input
                      required
                      maxLength={120}
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                    />
                  </label>
                </>
              )}
              <label>
                Email
                <input
                  type="email"
                  autoComplete="username"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  autoComplete={
                    registering ? "new-password" : "current-password"
                  }
                  minLength={registering ? 12 : undefined}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              {error && (
                <p className="message error" role="alert">
                  {error}
                </p>
              )}
              <button className="primary" disabled={signingIn}>
                {signingIn
                  ? "Please wait..."
                  : registering
                    ? "Create account and team"
                    : "Sign in"}
              </button>
            </form>
            <button
              type="button"
              disabled={signingIn}
              onClick={() => {
                setRegistering(!registering);
                setError("");
                setPassword("");
              }}
            >
              {registering
                ? "Use an existing account"
                : "Create a local account"}
            </button>
            <p className="muted">
              Your session stays in this tab’s memory. Refreshing signs you out.
            </p>
          </section>
        ) : (
          <>
            <div className="session-bar">
              <p>
                Signed in as <strong>{session.user.name}</strong>
              </p>
              <button
                disabled={guard.busy}
                onClick={() => {
                  if (mayLeave()) {
                    client.clear();
                    setSession(null);
                    setOrganization("");
                    setGuard({ dirty: false, busy: false });
                    setEmail("");
                    setError("");
                  }
                }}
              >
                Sign out
              </button>
            </div>
            {session.user.memberships.length ? (
              <>
                <OrganizationsPage
                  memberships={session.user.memberships}
                  current={organization}
                  disabled={guard.busy}
                  onChange={(id) => {
                    if (id !== organization && mayLeave()) setOrganization(id);
                  }}
                />
                <TasksPage
                  key={session.user.id + ":" + organization}
                  session={session}
                  membership={
                    session.user.memberships.find(
                      (m) => m.organization.id === organization,
                    )!
                  }
                  onGuardChange={setGuard}
                />
              </>
            ) : (
              <section className="panel">
                <h2>No organization access</h2>
                <p>
                  This account has no current memberships. Ask the local
                  workspace administrator to review access.
                </p>
              </section>
            )}
          </>
        )}
        <footer>
          A local learning workspace. Keep a database backup before schema
          changes.
        </footer>
      </main>
    </QueryClientProvider>
  );
}
