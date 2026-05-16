import autocannon from 'autocannon';

const targetUrl = process.env.PERF_TARGET_URL || 'http://127.0.0.1:3000';

console.log(`Starting stress test against ${targetUrl}`);

const instance = autocannon({
  url: targetUrl,
  method: 'GET',
  connections: 80,
  duration: 30,
  pipelining: 1,
  headers: {
    Accept: 'text/html',
  },
});

autocannon.track(instance, { renderProgressBar: true });

instance.on('done', (result) => {
  console.log('\nStress test complete');
  console.log(`Peak latency (p99): ${result.latency.p99.toFixed(2)} ms`);
  console.log(`Average requests/sec: ${result.requests.average.toFixed(2)}`);

  if (result.errors > 0 || result.non2xx > 0 || result.timeouts > 0) {
    process.exitCode = 1;
  }
});

instance.on('error', (error) => {
  console.error('Stress test failed:', error);
  process.exitCode = 1;
});
