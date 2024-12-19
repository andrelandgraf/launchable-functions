import { expect, test, assert } from 'vitest';
import WebSocket from 'ws';
import { z } from 'zod';
import { LaunchableItem, LaunchableFnArgs } from 'launch-functions';
import { WebApp } from './index';

test('WebApp.start starts the server, get /api/functions returns function names, WebApp.stop prevents new connections and stops server', async () => {
  const launchables: [LaunchableItem, ...LaunchableItem[]] = [
    {
      name: 'A',
      fn: () => {},
    },
    {
      name: 'B',
      fn: () => {},
    },
    {
      name: 'C',
      fn: () => {},
    },
  ];

  const webApp = new WebApp();
  webApp.start(launchables);

  const response = await fetch('http://localhost:3000/api/functions');
  const data = await response.json();
  expect(data).toEqual({
    functions: [
      {
        name: 'A',
        id: 'fn',
        schema: null,
      },
      {
        name: 'B',
        id: 'fn',
        schema: null,
      },
      {
        name: 'C',
        id: 'fn',
        schema: null,
      },
    ],
  });

  webApp.stop();
  try {
    await fetch('http://localhost:3000/api/functions');
    expect(false).toBeTruthy();
  } catch (error: unknown) {
    assert(error instanceof Error);
    expect(error.message).toEqual('fetch failed');
  }
});

test('WebApp.start starts the server on the specified port', async () => {
  const launchables: [LaunchableItem, ...LaunchableItem[]] = [
    {
      name: 'A',
      fn: () => {},
    },
  ];

  const webApp = new WebApp({ port: 3001 });
  webApp.start(launchables);

  const response = await fetch('http://localhost:3001/api/functions');
  const data = await response.json();
  expect(data).toEqual({ functions: ['A'] });

  webApp.stop();
});

test('WebApp.start/stop does not throw when called several times', async () => {
  const launchables: [LaunchableItem, ...LaunchableItem[]] = [
    {
      name: 'A',
      fn: () => {},
    },
  ];

  const webApp = new WebApp({ port: 3002 });
  webApp.start(launchables);
  webApp.start(launchables);
  webApp.start(launchables);

  webApp.stop();
  webApp.stop();
  webApp.stop();
});

test('WebApp WebSocket launch, prompt, print, success flow', async () => {
  const personSchema = z.object({
    name: z.string({ description: "Person's name" }).min(1, { message: 'Name cannot be empty' }),
    email: z.string({ description: "Person's email" }).email(),
  });

  function addPerson({ ctx }: LaunchableFnArgs) {
    return ctx.prompt(personSchema).then((person) => {
      ctx.print(`Person added: ${person.name} <${person.email}>`);
    });
  }

  const webApp = new WebApp({ port: 3003 });
  webApp.start([
    {
      name: 'addPerson',
      fn: addPerson,
    },
  ]);

  const ws = new WebSocket('ws://localhost:3003/ws');
  ws.onopen = () => {
    ws.send(JSON.stringify({ intent: 'launch', fnName: 'addPerson' }));
  };

  await new Promise<void>((resolve) => {
    let resCounter = 0;
    let taskId: string;
    ws.onmessage = (event) => {
      resCounter++;
      assert(typeof event.data === 'string');
      const data = JSON.parse(event.data);
      if (resCounter === 1) {
        expect(data).toEqual({ status: 'launched', taskId: expect.any(String) });
        taskId = data.taskId;
      }
      if (resCounter === 2) {
        expect(data).toEqual({
          status: 'prompt',
          jsonSchema: {
            $schema: 'http://json-schema.org/draft-07/schema#',
            additionalProperties: false,
            type: 'object',
            properties: {
              email: { description: "Person's email", type: 'string', format: 'email' },
              name: { description: "Person's name", type: 'string', minLength: 1 },
            },
            required: ['name', 'email'],
          },
        });
        ws.send(JSON.stringify({ intent: 'submit', taskId, promptData: { name: 'Alice', email: 'alice@gmail.com' } }));
      }
      if (resCounter === 3) {
        expect(data).toEqual({ status: 'print', content: 'Person added: Alice <alice@gmail.com>' });
      }
      if (resCounter === 4) {
        expect(data).toEqual({ status: 'success', result: undefined });
        resolve();
      }
    };
  });

  webApp.stop();
});
