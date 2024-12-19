import { z } from 'zod';
import { LaunchableFn } from 'launch-functions';
import { addAttendee } from '../app/attendees';

export const addAttendeeFn: LaunchableFn = async (ctx) => {
  const schema = z.object({
    name: z.string().min(1).max(255),
    email: z.string().max(255).email(),
  });

  const attendee = await ctx.prompt(schema);

  const success = await addAttendee({ ...attendee, status: 'going' });
  if (success) {
    ctx.print('Attendee added successfully');
  } else {
    ctx.print('Failed to add attendee');
  }
};
