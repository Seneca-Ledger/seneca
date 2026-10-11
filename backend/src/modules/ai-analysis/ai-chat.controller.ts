import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { toEnum } from '../../common/effect/to-enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import { AppendAiChatMessageBody, CreateAiChatBody, RenameAiChatBody } from '../../contracts';
import { AiChatRole } from '../../entities/ai-chat-message.entity';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AiChatService } from './ai-chat.service';

@Controller('ai-analysis/chats')
@UseGuards(JwtAuthGuard, WorkspaceContextGuard)
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  @Get()
  list(@WorkspaceId() workspaceId: string) {
    return this.aiChatService.list(workspaceId);
  }

  @Post()
  create(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(CreateAiChatBody) body: CreateAiChatBody,
  ) {
    return this.aiChatService.create(workspaceId, user.id, body.modelId, body.firstQuestion);
  }

  @Get(':id')
  get(@WorkspaceId() workspaceId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.aiChatService.get(workspaceId, id);
  }

  @Post(':id/messages')
  appendMessage(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @SchemaBody(AppendAiChatMessageBody) body: AppendAiChatMessageBody,
  ) {
    return this.aiChatService.appendMessage(
      workspaceId,
      id,
      toEnum(AiChatRole, body.role),
      body.content,
      body.actionPayload,
    );
  }

  @Patch(':id')
  rename(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @SchemaBody(RenameAiChatBody) body: RenameAiChatBody,
  ) {
    return this.aiChatService.rename(workspaceId, id, body.title);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@WorkspaceId() workspaceId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.aiChatService.remove(workspaceId, id);
  }
}
