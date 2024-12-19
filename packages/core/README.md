# launch-functions

Turn JS functions into command line tools and web UIs

## Setup

Install `launch-functions`, an adapter, and `zod` for schema validation:

```bash
npm install launch-functions @launch-functions/web zod
```

## Usage

Create a function that accepts a `LaunchableFnContext`. Use the context `prompt` and `print` methods to interact with the user. The schema for the prompt is defined using `zod`.

Call `launch` to turn the provided functions into a web UI, using the web adapter:

```ts
import { z } from 'zod';
import { launch, type LaunchableFnContext } from 'launch-functions';
import { WebApp } from '@launch-functions/web';

function greet(ctx: LaunchableFnContext) {
  const personSchema = z.object({
    name: z
      .string({ description: "Person's name" })
      .min(1, { message: 'Name cannot be empty' })
      .max(255, { message: 'Name is too long' }),
  });
  const { name } = await ctx.prompt(personSchema);
  ctx.print(`Hello, ${name}!`);
}

const webApp = new WebApp();
launch({ adapter: webApp }, greet);
```

## Available Adapters

- `@launch-functions/web`: Web UI
- `@launch-functions/cli`: Command line
