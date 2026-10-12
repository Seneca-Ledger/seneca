import { rejectedFields } from '../../../../helpers/schema-body';
import { AddPermissionBody, ChangeEmailBody, ChangePasswordBody, RemovePermissionBody, UpdatePermissionsBody } from '@/contracts';
import { Permission } from '@/common/enums/permissions.enum';

describe('User Security DTOs', () => {
  describe('ChangePasswordBody', () => {
    const validInput = {
      currentPassword: 'oldPassword123',
      newPassword: 'newPassword456',
    };

    it('passes validation with valid current and new passwords', async () => {
      const errors = rejectedFields(ChangePasswordBody, validInput);
      expect(errors).toHaveLength(0);
    });

    it('fails validation when newPassword is shorter than 8 characters', async () => {
      const errors = rejectedFields(ChangePasswordBody, { ...validInput, newPassword: 'short' });
      expect(errors.some(field => field === 'newPassword')).toBe(true);
    });

    it('passes validation when newPassword is exactly 8 characters', async () => {
      const errors = rejectedFields(ChangePasswordBody, { ...validInput, newPassword: 'exactly8' });
      expect(errors.filter(field => field === 'newPassword')).toHaveLength(0);
    });

    it('fails validation when currentPassword is missing', async () => {
      const errors = rejectedFields(ChangePasswordBody, { newPassword: validInput.newPassword });
      expect(errors.some(field => field === 'currentPassword')).toBe(true);
    });

    it('fails validation when newPassword is missing', async () => {
      const errors = rejectedFields(ChangePasswordBody, { currentPassword: validInput.currentPassword });
      expect(errors.some(field => field === 'newPassword')).toBe(true);
    });

    it('fails validation when currentPassword is not a string', async () => {
      const errors = rejectedFields(ChangePasswordBody, { ...validInput, currentPassword: 12345678 });
      expect(errors.some(field => field === 'currentPassword')).toBe(true);
    });
  });

  describe('ChangeEmailBody', () => {
    const validInput = {
      email: 'newemail@example.com',
      currentPassword: 'myPassword123',
    };

    it('passes validation with valid email and password', async () => {
      const errors = rejectedFields(ChangeEmailBody, validInput);
      expect(errors).toHaveLength(0);
    });

    it('fails validation for invalid email format', async () => {
      const errors = rejectedFields(ChangeEmailBody, { ...validInput, email: 'not-an-email' });
      expect(errors.some(field => field === 'email')).toBe(true);
    });

    it('fails validation for missing email', async () => {
      const errors = rejectedFields(ChangeEmailBody, { currentPassword: validInput.currentPassword });
      expect(errors.some(field => field === 'email')).toBe(true);
    });

    it('fails validation for missing currentPassword', async () => {
      const errors = rejectedFields(ChangeEmailBody, { email: validInput.email });
      expect(errors.some(field => field === 'currentPassword')).toBe(true);
    });

    it('rejects SQL injection attempt in email field', async () => {
      const errors = rejectedFields(ChangeEmailBody, {
        ...validInput,
        email: "'; DROP TABLE users; --",
      });
      expect(errors.some(field => field === 'email')).toBe(true);
    });
  });

  describe('UpdatePermissionsBody', () => {
    it('passes validation with array of valid Permission enum values', async () => {
      const errors = rejectedFields(UpdatePermissionsBody, {
        permissions: [Permission.STATEMENT_VIEW, Permission.TRANSACTION_VIEW],
      });
      expect(errors).toHaveLength(0);
    });

    it('passes validation with empty permissions array', async () => {
      const errors = rejectedFields(UpdatePermissionsBody, { permissions: [] });
      expect(errors).toHaveLength(0);
    });

    it('fails validation when permissions contains invalid enum value', async () => {
      const errors = rejectedFields(UpdatePermissionsBody, {
        permissions: ['invalid.permission', Permission.STATEMENT_VIEW],
      });
      expect(errors.some(field => field === 'permissions')).toBe(true);
    });

    it('fails validation when permissions is not an array', async () => {
      const errors = rejectedFields(UpdatePermissionsBody, {
        permissions: Permission.STATEMENT_VIEW,
      });
      expect(errors.some(field => field === 'permissions')).toBe(true);
    });

    it('fails validation when permissions contains arbitrary strings (injection attempt)', async () => {
      const errors = rejectedFields(UpdatePermissionsBody, {
        permissions: ['admin.all', 'root', '* '],
      });
      expect(errors.some(field => field === 'permissions')).toBe(true);
    });

    it('accepts all valid Permission enum values', async () => {
      const errors = rejectedFields(UpdatePermissionsBody, {
        permissions: Object.values(Permission),
      });
      expect(errors).toHaveLength(0);
    });
  });

  describe('AddPermissionBody', () => {
    it('passes validation with a valid Permission enum value', async () => {
      const errors = rejectedFields(AddPermissionBody, { permission: Permission.STATEMENT_DELETE });
      expect(errors).toHaveLength(0);
    });

    it('fails validation for invalid permission string', async () => {
      const errors = rejectedFields(AddPermissionBody, { permission: 'admin.escalate' });
      expect(errors.some(field => field === 'permission')).toBe(true);
    });

    it('fails validation when permission is missing', async () => {
      const errors = rejectedFields(AddPermissionBody, {});
      expect(errors.some(field => field === 'permission')).toBe(true);
    });
  });

  describe('RemovePermissionBody', () => {
    it('passes validation with a valid Permission enum value', async () => {
      const errors = rejectedFields(RemovePermissionBody, { permission: Permission.STATEMENT_VIEW });
      expect(errors).toHaveLength(0);
    });

    it('fails validation for invalid permission string', async () => {
      const errors = rejectedFields(RemovePermissionBody, { permission: 'anything.goes' });
      expect(errors.some(field => field === 'permission')).toBe(true);
    });

    it('fails validation when permission is missing', async () => {
      const errors = rejectedFields(RemovePermissionBody, {});
      expect(errors.some(field => field === 'permission')).toBe(true);
    });
  });
});
