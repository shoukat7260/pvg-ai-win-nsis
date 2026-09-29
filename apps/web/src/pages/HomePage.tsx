import { Link } from "react-router-dom";
import { Button } from "@pvg/ui";

export function HomePage() {
  return (
    <section className="public-hero">
      <div className="public-hero__panel">
        <p className="public-hero__brand">PVG AI</p>
        <h1 className="public-hero__headline">
          Local-first video creation. Cloud identity when you need it.
        </h1>
        <p className="public-hero__copy">
          Sign up for account, billing, and device-scoped provider connections.
          Generation and editors ship from the desktop workstation.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/signup">
            <Button size="lg">Create account</Button>
          </Link>
          <Link to="/pricing">
            <Button size="lg" variant="secondary">
              View pricing
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
