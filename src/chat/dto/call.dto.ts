import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

// An offer with camera, microphone and a screen share is about 10 KB.
const SDP_MAX = 24_000;

export class SessionDescriptionDto {
  @IsIn(['offer', 'answer'])
  type: 'offer' | 'answer';

  @IsString()
  @MaxLength(SDP_MAX)
  sdp: string;
}

/** RTCIceCandidate.toJSON(). Null fields come from the browser as null. */
export class IceCandidateDto {
  @IsString()
  @MaxLength(1_000)
  candidate: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sdpMid?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sdpMLineIndex?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  usernameFragment?: string | null;
}

/** One WebRTC message from one person in a call to another. */
export class CallSignalDto {
  @IsMongoId()
  roomId: string;

  // The other person's socket id, as the call told us.
  @IsString()
  @Length(1, 64)
  to: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SessionDescriptionDto)
  description?: SessionDescriptionDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => IceCandidateDto)
  candidate?: IceCandidateDto;
}

/** What the others see on someone's tile. */
export class CallStateDto {
  @IsMongoId()
  roomId: string;

  @IsBoolean()
  mic: boolean;

  @IsBoolean()
  cam: boolean;

  @IsBoolean()
  sharing: boolean;

  // The screen share's stream id, so the others can tell it from a camera:
  // both arrive as video.
  @IsOptional()
  @IsString()
  @MaxLength(64)
  screenId?: string;
}
