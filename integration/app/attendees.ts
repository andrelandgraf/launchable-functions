export type Attendee = {
  name: string;
  email: string;
  status: 'going' | 'not going';
};

const db = {
  attendees: [] as Array<Attendee>,
  addAttendee: async (attendee: Attendee) => {
    return new Promise<boolean>((resolve) => {
      setTimeout(() => {
        db.attendees.push(attendee);
        resolve(true);
      }, 1000);
    });
  },
};

export function addAttendee(attendee: Attendee) {
  return db.addAttendee(attendee);
}
