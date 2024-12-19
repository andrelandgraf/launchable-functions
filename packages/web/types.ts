import type { JsonSchema7Type } from 'zod-to-json-schema';

export type GetLaunchableItemsRes = {
  launchableItems: {
    name: string;
    schema: JsonSchema7Type | null;
  }[];
};

export type WsClientPayload =
  | {
      intent: 'launch';
      fnName: string;
      promptData: unknown;
    }
  | {
      intent: 'submit';
      promptData: unknown;
      taskId: string;
    };

export type WsServerPayload =
  | {
      status: 'print';
      content: string;
    }
  | {
      status: 'prompt';
      jsonSchema: JsonSchema7Type;
    }
  | {
      status: 'launched';
      taskId: string;
    }
  | {
      status: 'success';
      result: unknown;
    }
  | {
      status: 'error';
      message: string;
    };
