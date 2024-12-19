import { type ZodSchema } from 'zod';

/**
 * Content message that will be displayed to the user.
 */
export type Content = string;

/**
 * Context object that is passed to the launchable function.
 * - print: Call print to display a message to the user.
 * - prompt: Call prompt to prompt the user for additional input.
 */
export type LaunchableFnContext = {
  print: (content: Content) => Promise<void>;
  prompt: <TSchema extends ZodSchema>(schema: TSchema) => Promise<TSchema['_output']>;
};

/**
 * Config object for one launchable function.
 * - fn: The function to launch.
 * - name: The name of the function, displayed to the user. Must be unique.
 * - schema: The schema of initial data to prompt the user for.
 */
type Launchable<TSchema extends ZodSchema | undefined = undefined> = {
  fn: (args: {
    ctx: LaunchableFnContext;
    data: TSchema extends ZodSchema ? TSchema['_output'] : null;
  }) => void | Promise<void>;
  name: Content;
} & (TSchema extends ZodSchema ? { schema: TSchema } : { schema?: undefined });

/**
 * Arguments passed to the launchable function.
 * - ctx: Context object that is passed to the launchable function.
 * - data: Initial data based on the schema passed to the launchable object.
 */
export type LaunchableFnArgs<TSchema extends ZodSchema | undefined = undefined> = Parameters<
  Launchable<TSchema>['fn']
>[0];

/**
 * Launchable function & associated config data to launch.
 * - fn: The function to launch.
 * - name: The name of the function, displayed to the user.
 * - schema: The schema of initial data to prompt the user for.
 */
export type LaunchableItem =
  | Launchable<ZodSchema> // When schema is provided
  | {
      fn: (args: LaunchableFnArgs) => void | Promise<void>;
      name: Content;
      schema?: undefined;
    };

/**
 * Adapter for launching functions. Either web, cli, etc.
 * Needs to implement a start function that takes a list of launchable functions.
 */
export type LaunchAdapter = {
  start: (fns: [LaunchableItem, ...LaunchableItem[]]) => void;
};

/**
 * Launch context object. Passed to the launch function.
 */
export type LaunchContext = {
  adapter: LaunchAdapter;
};
