import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Put,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { SkipCsrf } from '../../common/decorators/skip-csrf.decorator';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams, SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { toEnum } from '../../common/effect/to-enum';
import { Permission } from '../../common/enums/permissions.enum';
import { appError } from '../../common/errors/app-error';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TimezonesService } from '../../common/services/timezones.service';
import { removeUploadedFile, validateImageSignature } from '../../common/utils/file-validator.util';
import { deletedResponse } from '../../common/utils/responses.util';
import {
  AddPermissionBody,
  AdminUser,
  AdminUserList,
  AvatarFileParams,
  ChangeEmailBody,
  ChangePasswordBody,
  CompleteOnboardingBody,
  ConfirmEmailChangeBody,
  DeleteMyAccountBody,
  DisclaimerAccepted,
  DisclaimerStatus,
  EmailChangeConfirmed,
  MessageResult,
  PageHintsSeen,
  PageHintsSeenBody,
  RemovePermissionBody,
  TimeZoneList,
  UpdateMyPreferencesBody,
  UpdatePermissionsBody,
  UpdateUserBody,
  UserIdParams,
  UserPermissions,
  UserPermissionsUpdate,
  UserProfile,
  UsersQuery,
  UserUpdateResponse,
  WelcomeTutorialSeen,
} from '../../contracts';
import { type User, UserRole } from '../../entities/user.entity';
import { toCurrentUser } from '../auth/current-user.view';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { avatarUploadOptions, sendAvatarFile } from './avatar-file.util';
import { CURRENT_DISCLAIMER_VERSION } from './disclaimer.constant';
import { AccountDataService } from './services/account-data.service';
import { EmailChangeService } from './services/email-change.service';
import { PermissionsService } from './services/permissions.service';
import { UsersService } from './users.service';

// Aliased rather than written inline: `emitDecoratorMetadata` turns a
// decorated parameter's type into a runtime reference, and the global
// `Express` namespace has no runtime value. A type alias is erased.
type MulterFile = Express.Multer.File;

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly permissionsService: PermissionsService,
    private readonly emailChangeService: EmailChangeService,
    private readonly timezonesService: TimezonesService,
    private readonly accountDataService: AccountDataService,
  ) {}

  @Get()
  @WorkspaceAuth(Permission.USER_VIEW_ALL)
  @SchemaResponse(AdminUserList)
  async findAll(@WorkspaceId() workspaceId: string, @SchemaQuery(UsersQuery) query: UsersQuery) {
    return this.usersService.findAll(workspaceId, query.limit ?? 20);
  }

  @Get('me')
  @SchemaResponse(UserProfile)
  async getProfile(@CurrentUser() user: User) {
    // The row the auth guard loaded, as `GET /auth/me` answers it.
    const { disclaimerAcceptedAt, disclaimerVersion } = user;
    return { ...toCurrentUser(user), disclaimerAcceptedAt, disclaimerVersion };
  }

  @Get('timezones')
  @SchemaResponse(TimeZoneList)
  async getTimeZones() {
    return { timeZones: this.timezonesService.listTimeZones() };
  }

  @Patch('me/onboarding')
  @SchemaResponse(UserUpdateResponse)
  async completeOnboarding(
    @CurrentUser() currentUser: User,
    @SchemaBody(CompleteOnboardingBody) dto: CompleteOnboardingBody,
  ) {
    const updatedUser = await this.usersService.completeOnboarding(currentUser.id, dto);
    const safeUser = toCurrentUser(updatedUser);
    return { user: safeUser, message: 'Onboarding completed successfully' };
  }

  @Get('me/export')
  async exportMyData(@CurrentUser() currentUser: User) {
    return this.accountDataService.exportMyData(currentUser.id);
  }

  @Delete('me')
  @SchemaResponse(MessageResult)
  async deleteMyAccount(
    @CurrentUser() currentUser: User,
    @SchemaBody(DeleteMyAccountBody) dto: DeleteMyAccountBody,
  ) {
    await this.accountDataService.deleteMyAccount(currentUser.id, dto.currentPassword);
    return deletedResponse('Account');
  }

  /**
   * The disclaimer text itself lives in the client bundle so it can be shown in
   * the user's language; this endpoint owns the record of what was accepted and
   * when, which is the part that has to be auditable.
   */
  @Post('me/disclaimer')
  @SchemaResponse(DisclaimerAccepted)
  async acceptDisclaimer(@CurrentUser() currentUser: User) {
    await this.usersService.acceptDisclaimer(currentUser.id);
    // The acceptance changes no field of the profile, so the guard's full row answers it.
    return { user: toCurrentUser(currentUser), version: CURRENT_DISCLAIMER_VERSION };
  }

  @Get('me/disclaimer')
  @SchemaResponse(DisclaimerStatus)
  async getDisclaimerStatus(@CurrentUser() currentUser: User) {
    const user = await this.usersService.getProfile(currentUser.id);
    return {
      version: CURRENT_DISCLAIMER_VERSION,
      acceptedAt: user.disclaimerAcceptedAt,
      acceptedVersion: user.disclaimerVersion,
      // Computed here rather than in the client so that bumping the version
      // re-prompts everyone without shipping a frontend release.
      accepted: user.disclaimerVersion === CURRENT_DISCLAIMER_VERSION,
    };
  }

  /**
   * Called when the user closes the welcome tutorial, so it stops opening by
   * itself. Returns only the timestamp: the client merges it into the user it
   * already has instead of replacing that with a partial profile.
   */
  @Post('me/welcome-tutorial')
  @SchemaResponse(WelcomeTutorialSeen)
  async markWelcomeTutorialSeen(@CurrentUser() currentUser: User) {
    const welcomeTutorialSeenAt = await this.usersService.markWelcomeTutorialSeen(currentUser.id);
    return { welcomeTutorialSeenAt };
  }

  /**
   * Called when the person closes a page's hints. Answers only the map, which the
   * client merges into the user it already has, like the welcome tutorial above.
   */
  @Post('me/page-hints')
  @SchemaResponse(PageHintsSeen)
  async markPageHintsSeen(
    @CurrentUser() currentUser: User,
    @SchemaBody(PageHintsSeenBody) body: PageHintsSeenBody,
  ) {
    const pageHintsSeen = await this.usersService.markPageHintsSeen(
      currentUser.id,
      body.page,
      body.version,
    );
    return { pageHintsSeen };
  }

  /** Settings → "Show hints again". */
  @Delete('me/page-hints')
  @SchemaResponse(PageHintsSeen)
  async resetPageHints(@CurrentUser() currentUser: User) {
    const pageHintsSeen = await this.usersService.resetPageHints(currentUser.id);
    return { pageHintsSeen };
  }

  @Public()
  @Get('avatars/:fileName')
  getAvatar(@SchemaParams(AvatarFileParams) { fileName }: AvatarFileParams, @Res() res: Response) {
    return sendAvatarFile(res, fileName);
  }

  @Get(':id')
  @SchemaResponse(AdminUser)
  async findOne(
    @SchemaParams(UserIdParams) { id }: UserIdParams,
    @CurrentUser() currentUser: User,
  ): Promise<User> {
    // Users can only view their own profile unless they're admin
    if (currentUser.role !== UserRole.ADMIN && currentUser.id !== id) {
      return this.usersService.getProfile(currentUser.id);
    }

    return this.usersService.findOne(id);
  }

  @Put(':id')
  @SchemaResponse(AdminUser)
  async update(
    @SchemaParams(UserIdParams) { id }: UserIdParams,
    @SchemaBody(UpdateUserBody) updateUserDto: UpdateUserBody,
    @CurrentUser() currentUser: User,
  ): Promise<User> {
    return this.usersService.update(id, updateUserDto, currentUser);
  }

  @Delete(':id')
  @WorkspaceAuth(Permission.USER_MANAGE)
  @SchemaResponse(MessageResult)
  async remove(
    @SchemaParams(UserIdParams) { id }: UserIdParams,
    @CurrentUser() currentUser: User,
  ): Promise<{ message: string }> {
    await this.usersService.remove(id, currentUser);
    return deletedResponse('User');
  }

  @Get(':id/permissions')
  @WorkspaceAuth(Permission.USER_MANAGE)
  @SchemaResponse(UserPermissions)
  async getUserPermissions(
    @SchemaParams(UserIdParams) { id }: UserIdParams,
    @WorkspaceId() workspaceId: string,
  ) {
    const user = await this.permissionsService.findUserInWorkspace(id, workspaceId);
    const permissions = this.permissionsService.getUserPermissions(user);
    return {
      userId: id,
      role: user.role,
      customPermissions: user.permissions || [],
      allPermissions: permissions,
    };
  }

  @Put(':id/permissions')
  @WorkspaceAuth(Permission.USER_MANAGE)
  @SchemaResponse(UserPermissionsUpdate)
  async updatePermissions(
    @SchemaParams(UserIdParams) { id }: UserIdParams,
    @SchemaBody(UpdatePermissionsBody) dto: UpdatePermissionsBody,
    @CurrentUser() currentUser: User,
    @WorkspaceId() workspaceId: string,
  ) {
    const user = await this.permissionsService.updateUserPermissions(
      id,
      dto.permissions.map(permission => toEnum(Permission, permission)),
      currentUser,
      workspaceId,
    );
    return {
      userId: id,
      permissions: user.permissions,
      message: 'Permissions updated successfully',
    };
  }

  @Post(':id/permissions/add')
  @WorkspaceAuth(Permission.USER_MANAGE)
  @SchemaResponse(UserPermissionsUpdate)
  async addPermission(
    @SchemaParams(UserIdParams) { id }: UserIdParams,
    @SchemaBody(AddPermissionBody) dto: AddPermissionBody,
    @CurrentUser() currentUser: User,
    @WorkspaceId() workspaceId: string,
  ) {
    const user = await this.permissionsService.addPermission(
      id,
      toEnum(Permission, dto.permission),
      currentUser,
      workspaceId,
    );
    return {
      userId: id,
      permissions: user.permissions,
      message: 'Permission added successfully',
    };
  }

  @Post(':id/permissions/remove')
  @WorkspaceAuth(Permission.USER_MANAGE)
  @SchemaResponse(UserPermissionsUpdate)
  async removePermission(
    @SchemaParams(UserIdParams) { id }: UserIdParams,
    @SchemaBody(RemovePermissionBody) dto: RemovePermissionBody,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() currentUser: User,
  ) {
    const user = await this.permissionsService.removePermission(
      id,
      toEnum(Permission, dto.permission),
      workspaceId,
      currentUser.id,
    );
    return {
      userId: id,
      permissions: user.permissions,
      message: 'Permission removed successfully',
    };
  }

  @Post(':id/permissions/reset')
  @WorkspaceAuth(Permission.USER_MANAGE)
  @SchemaResponse(UserPermissionsUpdate)
  async resetPermissions(
    @SchemaParams(UserIdParams) { id }: UserIdParams,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() currentUser: User,
  ) {
    const user = await this.permissionsService.resetPermissions(id, workspaceId, currentUser.id);
    return {
      userId: id,
      permissions: user.permissions,
      message: 'Permissions reset to role defaults',
    };
  }

  // Both of these bcrypt-verify the current password, which makes them an
  // online guessing oracle for anyone holding a stolen session.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Patch('me/email')
  @SchemaResponse(MessageResult)
  async changeEmail(
    @CurrentUser() currentUser: User,
    @SchemaBody(ChangeEmailBody) dto: ChangeEmailBody,
  ) {
    await this.usersService.requestEmailChange(currentUser.id, dto);

    // The address does not change until the link lands; say so rather than
    // reporting a success that has not happened yet.
    return {
      message: `Confirm the change from the link we sent to ${dto.email}.`,
    };
  }

  @Public()
  @SkipCsrf()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('me/email/confirm')
  @HttpCode(HttpStatus.OK)
  @SchemaResponse(EmailChangeConfirmed)
  async confirmEmailChange(@SchemaBody(ConfirmEmailChangeBody) dto: ConfirmEmailChangeBody) {
    const { email } = await this.emailChangeService.confirmEmailChange(dto.token);
    return { email, message: 'Email address confirmed.' };
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Patch('me/password')
  @SchemaResponse(MessageResult)
  async changePassword(
    @CurrentUser() currentUser: User,
    @SchemaBody(ChangePasswordBody) dto: ChangePasswordBody,
  ) {
    await this.usersService.changePassword(currentUser.id, dto);
    return { message: 'Password updated successfully' };
  }

  @Patch('me/preferences')
  @SchemaResponse(UserUpdateResponse)
  async updateMyPreferences(
    @CurrentUser() currentUser: User,
    @SchemaBody(UpdateMyPreferencesBody) dto: UpdateMyPreferencesBody,
  ) {
    const updatedUser = await this.usersService.updateMyPreferences(currentUser.id, dto);
    const safeUser = toCurrentUser(updatedUser);
    return { user: safeUser, message: 'Profile updated successfully' };
  }

  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('avatar', avatarUploadOptions))
  @SchemaResponse(UserUpdateResponse)
  async uploadMyAvatar(
    @CurrentUser() currentUser: User,
    @UploadedFile() file: MulterFile | undefined,
  ) {
    if (!file) {
      throw new BadRequestException(appError('FILE_NOT_UPLOADED'));
    }

    // The declared MIME type picked the extension; confirm the bytes agree
    // before the file becomes reachable through the public avatar route.
    try {
      validateImageSignature(file);
    } catch (error) {
      await removeUploadedFile(file);
      throw error;
    }

    const url = `/api/v1/users/avatars/${encodeURIComponent(file.filename)}`;
    const updatedUser = await this.usersService.updateMyAvatar(currentUser.id, url);
    const safeUser = toCurrentUser(updatedUser);
    return { user: safeUser, avatarUrl: url };
  }
}
