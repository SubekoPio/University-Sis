// Purpose: Validate refresh-token request bodies.
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

/** Request body accepted by POST /auth/refresh and POST /auth/logout. */
export class RefreshTokenDto {
  /** Opaque refresh token returned by login or refresh. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  refreshToken!: string;
}
