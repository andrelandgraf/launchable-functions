import { LaunchableItem, LaunchContext } from './types';

function hasAtLeastOneFunction(launchables: LaunchableItem[]): launchables is [LaunchableItem, ...LaunchableItem[]] {
  return launchables.length > 0;
}

/**
 * Launch a set of functions using the provided context.
 * - ctx: Launch context object, containing the adapter to use for launching functions.
 * - launchables: A list of launchable functions and associated configuration data.
 */
export function launch(ctx: LaunchContext, launchables: LaunchableItem[]) {
  if (!ctx || !ctx.adapter || !ctx.adapter.start || typeof ctx.adapter.start !== 'function') {
    throw new Error('Bad LaunchContext: Please pass a valid LaunchContext interface as the first argument to launch.');
  }
  if (!hasAtLeastOneFunction(launchables)) {
    throw new Error('No functions to launch: Please pass at least one function to launch.');
  }
  const { adapter } = ctx;
  adapter.start(launchables);
}
