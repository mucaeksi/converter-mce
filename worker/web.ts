import app, { type Env } from './index';

// Free-plan production deployment: conversions run on the user's device.
export default {
  fetch(request: Request, env: Pick<Env, 'ASSETS'>) {
    return app.fetch(request, { ASSETS: env.ASSETS, APP_ENV: 'production' } as Env);
  },
};
