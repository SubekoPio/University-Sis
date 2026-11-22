// Purpose: Provide the stored meeting link through the MeetingProvider contract.
import { ConflictException, Injectable } from "@nestjs/common";
import type { MeetingJoinRequest, MeetingProvider } from "./timetable.types.js";

/** Resolves the manually configured session URL without generating provider links. */
@Injectable()
export class ManualLinkProvider implements MeetingProvider {
  /** Returns the meeting URL stored on the session or reports that no link exists. */
  async getJoinUrl(request: MeetingJoinRequest): Promise<string> {
    if (request.storedMeetingUrl === null) {
      throw new ConflictException("The session does not have a meeting link.");
    }
    return request.storedMeetingUrl;
  }
}
