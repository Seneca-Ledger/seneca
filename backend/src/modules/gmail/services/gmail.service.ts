import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as path from 'path';
import type { Repository } from 'typeorm';
import { APP_NAME } from '../../../common/brand';
import { resolveUploadsDir } from '../../../common/utils/uploads.util';
import { GmailSettings, Integration } from '../../../entities';
import type { GmailApi } from '../gmail-api.types';
import { GmailOAuthService } from './gmail-oauth.service';

type GmailLabelsResponse = {
  labels?: Array<{ id?: string; name?: string }>;
};

type GmailMessageListResponse = {
  messages?: GmailApi.Message[];
  nextPageToken?: string;
};

type GmailAttachmentResponse = {
  data?: string;
};

@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);
  private static readonly MAX_SYNC_MESSAGES = 500;

  constructor(
    @InjectRepository(GmailSettings)
    private readonly gmailSettingsRepository: Repository<GmailSettings>,
    private readonly gmailOAuthService: GmailOAuthService,
  ) {}

  private async gmailJson<T>(
    accessToken: string,
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(init.headers || {}),
      },
    });
    if (!response.ok) {
      throw new Error(`Gmail REST request failed with status ${response.status}`);
    }
    return (await response.json()) as T;
  }

  async setupGmailEnvironment(integration: Integration): Promise<void> {
    try {
      const { accessToken } = await this.gmailOAuthService.getGmailClient(integration.workspaceId);

      // Get or create label
      const labelsResponse = await this.gmailJson<GmailLabelsResponse>(
        accessToken,
        'users/me/labels',
      );
      const existingLabel = labelsResponse.labels?.find(
        label => label.name === `${APP_NAME}/Receipts`,
      );

      let labelId: string;
      if (existingLabel?.id) {
        labelId = existingLabel.id;
      } else {
        const createLabelResponse = await this.gmailJson<{ id?: string }>(
          accessToken,
          'users/me/labels',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: `${APP_NAME}/Receipts`,
              labelListVisibility: 'labelShow',
              messageListVisibility: 'show',
            }),
          },
        );
        const createdLabelId = createLabelResponse.id;
        if (!createdLabelId) {
          throw new BadRequestException('Failed to create Gmail label');
        }
        labelId = createdLabelId;
      }

      // Create Gmail filter
      const filterCriteria = {
        hasAttachment: true,
        from: '',
        subject: '',
      };

      const filterAction = {
        addLabelIds: [labelId],
      };

      try {
        await this.gmailJson(accessToken, 'users/me/settings/filters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            criteria: filterCriteria,
            action: filterAction,
          }),
        });
      } catch (error) {
        this.logger.warn('Failed to create Gmail filter, continuing...', error);
      }

      // Update settings
      const settings = await this.gmailSettingsRepository.findOne({
        where: { integrationId: integration.id },
      });

      if (settings) {
        settings.labelId = labelId;
        settings.labelName = `${APP_NAME}/Receipts`;
        await this.gmailSettingsRepository.save(settings);
      }

      this.logger.log(`Gmail environment setup complete for integration ${integration.id}`);
    } catch (error) {
      this.logger.error('Failed to setup Gmail environment', error);
      throw error;
    }
  }

  async listMessages(
    workspaceId: string,
    query?: string,
    options?: {
      includeLabelFilter?: boolean;
      maxMessages?: number;
    },
  ): Promise<GmailApi.Message[]> {
    const { accessToken, integration } = await this.gmailOAuthService.getGmailClient(workspaceId);

    const settings = await this.gmailSettingsRepository.findOne({
      where: { integrationId: integration.id },
    });

    const includeLabelFilter = options?.includeLabelFilter !== false;
    const maxMessages = Math.max(
      1,
      Math.min(
        options?.maxMessages ?? GmailService.MAX_SYNC_MESSAGES,
        GmailService.MAX_SYNC_MESSAGES,
      ),
    );

    let searchQuery = query || '';
    if (includeLabelFilter && settings?.labelId && !searchQuery.includes('label:')) {
      searchQuery = `label:${settings.labelId} ${searchQuery}`.trim();
    }

    const messages: GmailApi.Message[] = [];
    let pageToken: string | undefined;

    while (messages.length < maxMessages) {
      const remaining = maxMessages - messages.length;
      const response = await this.gmailJson<GmailMessageListResponse>(
        accessToken,
        `users/me/messages?${new URLSearchParams({
          ...(searchQuery ? { q: searchQuery } : {}),
          maxResults: String(Math.min(100, remaining)),
          ...(pageToken ? { pageToken } : {}),
        }).toString()}`,
      );

      const batch = response.messages || [];
      messages.push(...batch);

      pageToken = response.nextPageToken || undefined;
      if (!pageToken || batch.length === 0) {
        break;
      }
    }

    return messages;
  }

  async getMessage(workspaceId: string, messageId: string): Promise<GmailApi.Message> {
    const { accessToken } = await this.gmailOAuthService.getGmailClient(workspaceId);

    return this.gmailJson<GmailApi.Message>(
      accessToken,
      `users/me/messages/${encodeURIComponent(messageId)}?format=full`,
    );
  }

  async downloadAttachment(
    workspaceId: string,
    messageId: string,
    attachmentId: string,
    filename: string,
  ): Promise<string> {
    const { accessToken } = await this.gmailOAuthService.getGmailClient(workspaceId);

    const response = await this.gmailJson<GmailAttachmentResponse>(
      accessToken,
      `users/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
    );

    const data = response.data;
    if (!data) {
      throw new BadRequestException('No attachment data received');
    }

    // Decode base64url encoded data
    const buffer = Buffer.from(data, 'base64url');

    // Save to uploads directory
    const uploadsDir = resolveUploadsDir();
    const receiptsDir = path.join(uploadsDir, 'receipts');

    if (!fs.existsSync(receiptsDir)) {
      fs.mkdirSync(receiptsDir, { recursive: true });
    }

    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = path.join(receiptsDir, `${timestamp}-${sanitizedFilename}`);

    fs.writeFileSync(filePath, buffer);

    return filePath;
  }

  async getAttachmentData(
    workspaceId: string,
    messageId: string,
    attachmentId: string,
  ): Promise<string | null> {
    const { accessToken } = await this.gmailOAuthService.getGmailClient(workspaceId);
    const response = await this.gmailJson<GmailAttachmentResponse>(
      accessToken,
      `users/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
    );
    return response.data || null;
  }

  async updateMessageLabels(
    workspaceId: string,
    messageId: string,
    addLabelIds?: string[],
    removeLabelIds?: string[],
  ): Promise<void> {
    const { accessToken } = await this.gmailOAuthService.getGmailClient(workspaceId);

    await this.gmailJson(accessToken, `users/me/messages/${encodeURIComponent(messageId)}/modify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        addLabelIds,
        removeLabelIds,
      }),
    });
  }
}
