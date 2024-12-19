import { LaunchContext, LaunchAdapter, LaunchableItem, LaunchableFnArgs } from './types';
import { launch as _launch } from './main';

/**
 *
 * @param ctx Launch context object
 * @param ctx.adapter The adapter to use for launching functions, e.g. web, cli, etc.
 * @param fns A list of functions and associated config data to launch.
 * @example
 * import { z } from 'zod';
 * import { launch, LaunchableFnArgs } from 'launch-functions';
 * import { WebApp } from '@launch-functions/web';
 * import { savePerson } from './app';
 *
 * function greet({ ctx }: LaunchableFnArgs) {
 *  const personSchema = z.object({
 *    name: z.string({ description: "Person's name" })
 *      .min(1, { message: 'Name cannot be empty' })
 *      .max(255, { message: 'Name is too long' }),
 *  });
 *  const { name } = await ctx.prompt(personSchema);
 *  await savePerson({ name });
 *  ctx.print(`${name} saved!`);
 * }
 *
 * const webApp = new WebApp();
 * launch({ adapter: webApp }, [greet]);
 */
export function launch(ctx: LaunchContext, fns: LaunchableItem[]) {
  return _launch(ctx, fns);
}

export type { LaunchAdapter, LaunchContext, LaunchableItem, LaunchableFnArgs };
