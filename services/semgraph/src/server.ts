import { buildApp } from './app.ts';

const app = await buildApp();
const port = Number(process.env.PORT ?? 8080);
const host = process.env.HOST ?? '0.0.0.0';

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, 'shutting down');
    app.close().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  });
}

await app.listen({ port, host });
