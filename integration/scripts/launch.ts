import { launch } from 'launch-functions';
import { WebApp } from '@launch-functions/web';
import { addAttendeeFn } from './add-attendee';

const webApp = new WebApp();
launch({ adapter: webApp }, addAttendeeFn);
