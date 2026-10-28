import {
  BadGatewayException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Effect, Schema } from 'effect';
import type { Repository } from 'typeorm';
import { EffectRuntime } from '../../../common/effect/effect-runtime';
import { describeHttpFailure, postJson } from '../../../common/effect/http-json';
import { appError } from '../../../common/errors/app-error';
import type { TeachShareInfo, TeachShareResult } from '../../../contracts';
import { ParsingLayoutTemplate } from '../../../entities/parsing-layout-template.entity';
import { Statement } from '../../../entities/statement.entity';
import { type LayoutSubmission, layoutSubmission } from '../helpers/layout-submission.helper';
import { layoutShareConfig } from './layout-share.config';

/** The receiving Worker's answer (infra/parser-submissions). */
const Received = Schema.Struct({ received: Schema.Literal(true) });

/**
 * Sharing a layout a user taught with the project, at their request: what
 * would be sent (shown to them first), and sending it to the project's
 * Worker. Only the layout taught on the statement leaves the instance, built
 * here from the stored template, never from the request.
 */
@Injectable()
export class LayoutShareService {
  private readonly logger = new Logger(LayoutShareService.name);

  constructor(
    @InjectRepository(ParsingLayoutTemplate)
    private readonly templates: Repository<ParsingLayoutTemplate>,
    @InjectRepository(Statement)
    private readonly statements: Repository<Statement>,
    private readonly effects: EffectRuntime,
  ) {}

  async info(id: string, workspaceId: string): Promise<TeachShareInfo> {
    const config = layoutShareConfig();
    return {
      enabled: config.enabled,
      direct: config.url !== '',
      email: config.email,
      submission: await this.submission(id, workspaceId),
    };
  }

  async share(id: string, workspaceId: string): Promise<TeachShareResult> {
    const config = layoutShareConfig();
    if (!(config.enabled && config.url)) {
      throw new ForbiddenException(appError('PARSER_SUBMISSIONS_DISABLED'));
    }
    const submission = await this.submission(id, workspaceId);
    const sent = await this.effects.run(
      postJson(config.url, submission, Received, { timeout: '10 seconds' }).pipe(
        Effect.as(true),
        Effect.catch(error =>
          Effect.sync(() => {
            this.logger.warn(`Sharing a layout failed: ${describeHttpFailure(error)}`);
            return false;
          }),
        ),
      ),
    );
    if (!sent) {
      throw new BadGatewayException(appError('PARSER_SUBMISSION_FAILED'));
    }
    this.logger.log(`Layout shared for bank ${submission.bankName}`);
    return { sent: true };
  }

  private async submission(id: string, workspaceId: string): Promise<LayoutSubmission> {
    const statement = await this.statements.findOne({ where: { id, workspaceId } });
    if (!statement) {
      throw new NotFoundException(appError('STATEMENT_NOT_FOUND'));
    }
    const taught = await this.templates.findOne({
      where: { workspaceId, statementId: id },
      order: { updatedAt: 'DESC' },
    });
    if (!taught) {
      throw new NotFoundException(appError('STATEMENT_TEACH_TEMPLATE_NOT_FOUND'));
    }
    return layoutSubmission(
      taught.template,
      taught.bankName,
      process.env.APP_VERSION?.trim() || undefined,
    );
  }
}
