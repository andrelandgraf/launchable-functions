import type { LaunchableItem, LaunchAdapter } from 'launch-functions';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { WSContext } from 'hono/ws';
import { serve, ServerType } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { ZodSchema } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { createNodeWebSocket } from './server/ws';
import type { GetLaunchableItemsRes, WsClientPayload, WsServerPayload } from './types';

export type WebAppConfig = {
  /**
   * Port on which the server will listen. Defaults to 3000.
   */
  port?: number;
  /**
   * Hostname on which the server will listen. Defaults to 'localhost'.
   */
  hostname?: string;
  /**
   * Path to @launch-functions/web package folder relative to current working directory
   * from which the app was started. Absolute paths are not supported.
   * Defaults to './node_modules/@launch-functions/web'.
   */
  relativePathToPackage?: string;
};

type Task = {
  launchable: LaunchableItem;
  taskId: string;
  ws: WSContext;
  execution?: {
    destroyed?: boolean;
    timeout?: NodeJS.Timeout;
    reject: (error: Error) => void;
  };
  pendingPrompt?: {
    destroyed?: boolean;
    timeout?: NodeJS.Timeout;
    resolve: (data: unknown) => void;
    reject: (error: Error) => void;
    zodSchema: ZodSchema;
  };
};

function isWsPayload(data: unknown): data is WsClientPayload {
  const isIntentObject = !!data && typeof data === 'object' && 'intent' in data;
  if (!isIntentObject) {
    console.error('Payload not an object but', typeof data);
    return false;
  }
  if (data.intent === 'launch') {
    console.error('data:', data);
    return 'fnName' in data;
  }
  if (data.intent === 'submit') {
    console.error('data:', data);
    return 'promptData' in data && 'taskId' in data;
  }
  return false;
}

function sendWsMessage(ws: WSContext, payload: WsServerPayload) {
  console.log('Sending payload to client:', payload);
  ws.send(JSON.stringify(payload));
}

function destroyTask(task: Task, message: string) {
  if (task.pendingPrompt && !task.pendingPrompt.destroyed) {
    task.pendingPrompt.destroyed = true;
    clearTimeout(task.pendingPrompt.timeout);
    task.pendingPrompt.reject(new Error(message));
  }
  if (task.execution && !task.execution.destroyed) {
    task.execution.destroyed = true;
    clearTimeout(task.execution.timeout);
    task.execution.reject(new Error(message));
  }
}

export class WebApp implements LaunchAdapter {
  server: ServerType | null = null;
  port: number;
  hostname: string;
  relativePathToPackage: string;
  tasks: Task[] = [];

  constructor(config?: WebAppConfig) {
    this.port = config?.port || 3000;
    this.hostname = config?.hostname || 'localhost';
    this.relativePathToPackage = config?.relativePathToPackage || './node_modules/@launch-functions/web';
  }

  start(launchables: [LaunchableItem, ...LaunchableItem[]]) {
    if (this.server) {
      return;
    }
    const app = new Hono();

    const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

    app.get('/ws', async (c, next) => {
      const handler = upgradeWebSocket(() => {
        return {
          onError: async (error) => {
            console.error('Error:', error);
          },
          onMessage: async (message, ws) => {
            let payload = message.data;
            console.log('Received payload from client:', payload);
            if (typeof payload === 'string') {
              try {
                payload = JSON.parse(payload);
              } catch (error: unknown) {
                console.error('Invalid JSON:', error);
                sendWsMessage(ws, { status: 'error', message: 'Invalid JSON' });
                ws.close();
                return;
              }
            }
            if (!isWsPayload(payload)) {
              console.error('Invalid payload:', payload);
              sendWsMessage(ws, { status: 'error', message: 'Invalid payload' });
              ws.close();
              return;
            }
            if (payload.intent === 'launch') {
              const launchable = launchables.find((launchable) => launchable.name === payload.fnName);
              if (!launchable) {
                sendWsMessage(ws, { status: 'error', message: 'Function not found' });
                ws.close();
                return;
              }
              let initialLaunchData = null;
              if (payload.promptData && launchable.schema) {
                try {
                  initialLaunchData = launchable.schema.parse(payload.promptData);
                } catch (error: unknown) {
                  sendWsMessage(ws, { status: 'error', message: 'Invalid initial data' });
                  ws.close();
                  return;
                }
              }
              const taskId = randomUUID();
              const task: Task = { launchable, taskId, ws };
              try {
                const result = await new Promise(async (resolve, reject) => {
                  const executionTimeout = setTimeout(
                    () => {
                      this.tasks = this.tasks.filter((t) => t.taskId !== taskId);
                      reject(new Error('Execution timed out'));
                      // one hour
                    },
                    60 * 60 * 1000,
                  );
                  task.execution = {
                    timeout: executionTimeout,
                    reject,
                  };
                  this.tasks.push(task);
                  sendWsMessage(ws, { status: 'launched', taskId });
                  const result = await launchable.fn({
                    data: initialLaunchData,
                    ctx: {
                      print: async (content) => {
                        sendWsMessage(ws, { status: 'print', content });
                      },
                      prompt: async (zodSchema) => {
                        const jsonSchema = zodToJsonSchema(zodSchema);
                        if (!jsonSchema) {
                          sendWsMessage(ws, { status: 'error', message: 'Invalid schema' });
                          return {};
                        }
                        sendWsMessage(ws, { status: 'prompt', jsonSchema });

                        try {
                          const pendingPrompt = new Promise((resolve, reject) => {
                            const timeout = setTimeout(
                              () => {
                                reject(new Error('Prompt timed out'));
                              }, // one hour
                              60 * 60 * 1000,
                            );
                            task.pendingPrompt = { resolve, reject, zodSchema, timeout };
                          });
                          const data = await pendingPrompt;
                          return data;
                        } catch (error: unknown) {
                          const message = error instanceof Error ? error.message : 'Prompting failed';
                          destroyTask(task, message);
                          sendWsMessage(ws, { status: 'error', message });
                          return;
                        }
                      },
                    },
                  });
                  resolve(result);
                });
                sendWsMessage(ws, { status: 'success', result });
              } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Execution failed';
                destroyTask(task, message);
                sendWsMessage(ws, { status: 'error', message });
                return;
              }
            }
            if (payload.intent === 'submit') {
              const taskId = payload.taskId;
              const task = this.tasks.find((task) => task.taskId === taskId);
              if (!task) {
                sendWsMessage(ws, { status: 'error', message: 'Task not found' });
                ws.close();
                return;
              }
              if (!task.pendingPrompt || task.pendingPrompt.destroyed) {
                sendWsMessage(ws, { status: 'error', message: 'No pending prompt' });
                ws.close();
                return;
              }
              const { zodSchema, resolve, reject } = task.pendingPrompt;
              try {
                const parsedData = zodSchema.parse(payload.promptData);
                clearTimeout(task.pendingPrompt.timeout);
                task.pendingPrompt.destroyed = true;
                resolve(parsedData);
              } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Invalid data';
                reject(new Error(message));
              }
            }
          },
          onClose: async (_, ws) => {
            const task = this.tasks.find((task) => task.ws === ws);
            if (!task) return;
            this.tasks = this.tasks.filter((task) => task.ws !== ws);
            destroyTask(task, 'WebSocket connection closed');
          },
        };
      });
      return handler(c, next);
    });

    app.use('/', serveStatic({ root: `${this.relativePathToPackage}/dist/client/index.html` }));
    app.use('*', serveStatic({ root: `${this.relativePathToPackage}/dist/client` }));

    app.get('/api/functions', (c) => {
      const resJson: GetLaunchableItemsRes = {
        functions: launchables.map((launchable) => ({
          name: launchable.name,
          schema: launchable.schema ? zodToJsonSchema(launchable.schema) : null,
        })),
      };
      return c.json(resJson);
    });

    console.log(`Server is running on http://${this.hostname}:${this.port}`);
    this.server = serve({
      fetch: app.fetch,
      port: this.port,
      hostname: this.hostname,
    });
    injectWebSocket(this.server);
  }

  stop() {
    if (!this.server) {
      return;
    }
    this.server.close();
    this.server = null;
  }
}
