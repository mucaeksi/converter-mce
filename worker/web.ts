import app, { type Env } from './index';

// Device-only deployment while the account's Containers plan is being enabled.
export default {
  fetch(request: Request, env: Pick<Env, 'ASSETS'>) {
    return app.fetch(request, { ASSETS: env.ASSETS, APP_ENV: 'production' } as Env);
  },
};
