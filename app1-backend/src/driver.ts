const PORT = Number(process.env.PORT ?? 3000);

// Requests that currently fail at runtime; each exercises one endpoint.
const requests = ['/orders?user=carol', '/items?key=broken', '/share?total=1000&parts=0'];

/** Self-driver: calls the endpoints on a loop so the app produces traffic (and errors) on its own. */
export function startDriver(): void {
  let i = 0;
  setInterval(async () => {
    const path = requests[i++ % requests.length];
    try {
      const res = await fetch(`http://localhost:${PORT}${path}`);
      console.log(`[app1] GET ${path} -> ${res.status} ${await res.text()}`);
    } catch {
      // server not ready yet; ignore
    }
  }, 3000);
}
