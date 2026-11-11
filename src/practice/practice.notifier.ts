import { Injectable } from '@nestjs/common';
import { Namespace } from 'socket.io';

/**
 * Sends events to everyone watching an interview (the candidate's open
 * tabs). The gateway hands over its namespace at start-up, so services can
 * notify without depending on the gateway. With Redis on, events reach
 * sockets on every server.
 */
@Injectable()
export class PracticeNotifier {
  server?: Namespace;

  static room(interviewId: string): string {
    return `practice:${interviewId}`;
  }

  emit(interviewId: string, event: string, data: unknown): void {
    this.server?.to(PracticeNotifier.room(interviewId)).emit(event, data);
  }
}
