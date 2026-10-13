import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaResponse } from '../../common/effect/schema-response';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import { ChatCompletionStatus, CreateChatCompletionBody } from '../../contracts';
import type { User } from '../../entities';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ChatCompletionService } from './chat-completion.service';

@Controller('ai-analysis/completions')
@UseGuards(JwtAuthGuard, WorkspaceContextGuard)
export class ChatCompletionController {
  constructor(private readonly chatCompletionService: ChatCompletionService) {}

  /** Whether chat mode can use a cloud model for this member. */
  @Get('status')
  @SchemaResponse(ChatCompletionStatus)
  status(@WorkspaceId() workspaceId: string, @CurrentUser() user: User) {
    return this.chatCompletionService.isConfigured(workspaceId, user.id);
  }

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  complete(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
    @SchemaBody(CreateChatCompletionBody) body: CreateChatCompletionBody,
  ) {
    return this.chatCompletionService.complete(workspaceId, user.id, body.messages);
  }
}
