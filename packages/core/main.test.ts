import { beforeEach, expect, test, assert } from 'vitest';
import zod from 'zod';
import { launch } from './main';
import { LaunchAdapter, LaunchableItem, LaunchableFnArgs } from './types';

let launchableItems: LaunchableItem[] = [];
const adapter: LaunchAdapter = {
  start(items) {
    launchableItems = items;
  },
};

beforeEach(() => {
  launchableItems = [];
});

test.each([undefined, {}, { adapter: 1234 }, { adapter: {} }, { adapter: { start: {} } }])(
  'calling launch without adapter throws',
  (deps) => {
    try {
      // @ts-ignore
      launch(deps);
      expect(false).toBeTruthy();
    } catch (error: unknown) {
      assert(error instanceof Error);
      expect(error.message).toEqual(
        'Bad LaunchContext: Please pass a valid LaunchContext interface as the first argument to launch.',
      );
    }
  },
);

test('calling launch without functions throws', () => {
  try {
    // @ts-ignore
    launch({ adapter });
    expect(false).toBeTruthy();
  } catch (error: unknown) {
    assert(error instanceof Error);
    expect(error.message).toEqual('No functions to launch: Please pass at least one function to launch.');
  }
});

test('calling launch with valid args calls adapter start function with functions list', () => {
  async function greet({ ctx }: LaunchableFnArgs) {
    const schema = zod.object({
      name: zod
        .string({
          description: 'Your name',
          message: 'Name is required',
        })
        .min(1, 'Name is required'),
    });
    const { name } = await ctx.prompt(schema);
    console.log(`Hello, ${name}!`);
  }
  launch({ adapter }, [
    {
      fn: greet,
      name: 'Greet',
    },
  ]);
  expect(launchableItems).toEqual([greet]);
});

test('creating launch function with generic passed to args for initial prompt schema produces function type with correct data signature', () => {
  const schema = zod.object({
    name: zod
      .string({
        description: 'Your name',
        message: 'Name is required',
      })
      .min(1, 'Name is required'),
  });
  async function greet({ data }: LaunchableFnArgs<typeof schema>) {
    console.log(`Hello, ${data.name}!`);
  }
  launch({ adapter }, [
    {
      fn: greet,
      name: 'Greet',
      schema: schema,
    },
  ]);
  expect(launchableItems).toEqual([greet]);
});

test('creating launchable item inline with schema for initial prompt schema produces function type with correct data signature', () => {
  const schema = zod.object({
    name: zod
      .string({
        description: 'Your name',
        message: 'Name is required',
      })
      .min(1, 'Name is required'),
  });
  launch({ adapter }, [
    {
      name: 'Greet',
      fn: ({ data }) => {
        console.log(`Hello, ${data.name}!`);
      },
      schema,
    },
  ]);
  expect(launchableItems).toHaveLength(1);
});
