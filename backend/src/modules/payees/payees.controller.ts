import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { Permission } from '../../common/enums/permissions.enum';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  MergePayeesDto,
  PayeesQueryDto,
  SetTransactionPayeeDto,
  UpdatePayeeDto,
} from './dto/payees.dto';
import { PayeesService } from './payees.service';

@Controller()
export class PayeesController {
  constructor(private readonly payeesService: PayeesService) {}

  @Get('payees')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  async list(@WorkspaceId() workspaceId: string, @Query() query: PayeesQueryDto) {
    return this.payeesService.list(workspaceId, query);
  }

  @Patch('payees/:id')
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdatePayeeDto,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payeesService.update(workspaceId, user.id, id, body);
  }

  /** Asks the EU's VIES again whether the payee's VAT number is valid. */
  @Post('payees/:id/vat-check')
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  async recheckVatId(
    @Param('id', new ParseUUIDPipe()) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payeesService.recheckVatId(workspaceId, id);
  }

  /** Folds `sourceIds` into this payee. */
  @Post('payees/:id/merge')
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  async merge(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: MergePayeesDto,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payeesService.merge(workspaceId, user.id, id, body);
  }

  /** Rows of this payee in Review whose category nobody chose yet. */
  @Get('payees/:id/pending-review')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  async pendingReview(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('excludeTransactionId', new ParseUUIDPipe({ optional: true }))
    excludeTransactionId: string | undefined,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payeesService.pendingReview(workspaceId, id, excludeTransactionId);
  }

  @Put('transactions/:id/payee')
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  async setTransactionPayee(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: SetTransactionPayeeDto,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payeesService.setTransactionPayee(workspaceId, user.id, id, body);
  }
}
