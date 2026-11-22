// Purpose: Expose the sole secured HTTP endpoint for external applications.
import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import {
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { ApplicationsService } from "./applications.service.js";
import type { WebsiteApplicationResult } from "./admissions.types.js";
import { WebsiteApplicationDto } from "./dto/website-application.dto.js";
import { WebsiteIntegrationGuard } from "./website-integration.guard.js";

/** Receives authenticated, rate-limited applications from the university website. */
@ApiTags("Integrations")
@Controller("integrations/applications")
export class IntegrationsController {
  /** Receives the application workflow service. */
  constructor(private readonly applications: ApplicationsService) {}

  /** Stores an external application once per external reference. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ThrottlerGuard, WebsiteIntegrationGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: "Receive a secured website application" })
  @ApiCreatedResponse({
    description: "Application accepted or previously received.",
  })
  @ApiUnauthorizedResponse({
    description: "A valid API key or HMAC signature is required.",
  })
  @ApiTooManyRequestsResponse({
    description: "The website intake rate limit was exceeded.",
  })
  createApplication(@Body() input: WebsiteApplicationDto): Promise<WebsiteApplicationResult> {
    return this.applications.createWebsiteApplication(input);
  }
}
