// Purpose: Expose HTTP endpoints for the authentication service.
import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import type { Request } from "express";
import { AuthService } from "./auth.service.js";
import { PasswordRecoveryService } from "./password-recovery.service.js";
import { EmailAddressDto } from "./dto/email-address.dto.js";
import { LoginDto } from "./dto/login.dto.js";
import { RefreshTokenDto } from "./dto/refresh-token.dto.js";
import { RegisterDto } from "./dto/register.dto.js";
import { ResetPasswordDto } from "./dto/reset-password.dto.js";
import { VerifyEmailDto } from "./dto/verify-email.dto.js";

/** Maps authentication HTTP requests to AuthService calls. */
@Controller("auth")
export class AuthController {
  /**
   *
   */
  constructor(
    private readonly authService: AuthService,
    private readonly passwordRecoveryService: PasswordRecoveryService,
  ) {}

  /** Authenticates credentials and returns access and refresh tokens. */
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(@Body() input: LoginDto, @Req() request: Request) {
    return this.authService.login(input, {
      ip: request.ip,
      userAgent: request.get("user-agent"),
    });
  }

  /** Registers a user account. */
  @Post("register")
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  register(@Body() input: RegisterDto) {
    return this.authService.register(input);
  }

  /** Rotates a refresh token and returns the replacement token pair. */
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  refresh(@Body() input: RefreshTokenDto, @Req() request: Request) {
    return this.authService.refreshToken(input.refreshToken, {
      ip: request.ip,
      userAgent: request.get("user-agent"),
    });
  }

  /** Revokes the session identified by the supplied refresh token. */
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@Body() input: RefreshTokenDto): Promise<{ success: true }> {
    await this.authService.logout(input.refreshToken);
    return { success: true };
  }

  /** Sends password-reset instructions without disclosing whether the email exists. */
  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  forgotPassword(@Body() input: EmailAddressDto) {
    return this.passwordRecoveryService.forgotPassword(input.email);
  }

  /** Consumes a reset token, changes the password, and revokes existing sessions. */
  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async resetPassword(@Body() input: ResetPasswordDto): Promise<{ message: string }> {
    await this.passwordRecoveryService.resetPassword(input.token, input.password);
    return { message: "Password reset successfully." };
  }

  /** Consumes a valid email-verification token. */
  @Post("verify-email")
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async verifyEmail(@Body() input: VerifyEmailDto): Promise<{ message: string }> {
    await this.passwordRecoveryService.verifyEmail(input.token);
    return { message: "Email verified successfully." };
  }

  /** Resends verification instructions without disclosing account state. */
  @Post("resend-verification")
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  resendVerification(@Body() input: EmailAddressDto) {
    return this.passwordRecoveryService.resendVerification(input.email);
  }
}
