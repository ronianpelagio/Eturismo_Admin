import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">ETurismo</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Sign in to the admin panel to manage artifacts, users, events, and more.
        </p>
        <Link
          to="/admin"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Open Admin Panel
        </Link>
      </div>
    </div>
  );
}
