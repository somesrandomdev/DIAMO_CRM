async function run() {
  const numKiosks = 20;
  console.log(`Simulating N+1 queries for ${numKiosks} kiosks with 50ms latency each`);

  // N+1 approach
  const start1 = Date.now();
  await Promise.all(
    Array.from({ length: numKiosks }).map(async (_, i) => {
      await new Promise(resolve => setTimeout(resolve, 50));
    })
  );
  const end1 = Date.now();
  console.log(`Original Promise.all with N+1 queries: ${end1 - start1}ms (simulated concurrent network requests overhead + latency)`);

  // Single query approach
  const start2 = Date.now();
  // One query with 50ms latency + slightly higher processing time (e.g., 60ms)
  await new Promise(resolve => setTimeout(resolve, 60));
  const end2 = Date.now();
  console.log(`Optimized single .in() query: ${end2 - start2}ms`);
}
run();
