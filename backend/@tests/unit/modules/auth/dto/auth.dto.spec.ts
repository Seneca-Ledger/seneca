import { rejectedFields } from '../../../../helpers/schema-body';
import { LoginBody, RegisterBody } from '@/contracts';

describe('Auth DTOs', () => {
  describe('LoginBody', () => {
    const validInput = { email: 'user@example.com', password: 'anypassword' };

    it('passes validation with valid email and password', async () => {
      const errors = rejectedFields(LoginBody, validInput);
      expect(errors).toHaveLength(0);
    });

    it('fails validation for invalid email format', async () => {
      const errors = rejectedFields(LoginBody, { ...validInput, email: 'not-an-email' });
      expect(errors.some(field => field === 'email')).toBe(true);
    });

    it('fails validation for missing email', async () => {
      const errors = rejectedFields(LoginBody, { password: 'password123' });
      expect(errors.some(field => field === 'email')).toBe(true);
    });

    it('fails validation for missing password', async () => {
      const errors = rejectedFields(LoginBody, { email: 'user@example.com' });
      expect(errors.some(field => field === 'password')).toBe(true);
    });

    it('fails validation when password is a number (not string)', async () => {
      const errors = rejectedFields(LoginBody, { ...validInput, password: 12345678 });
      expect(errors.some(field => field === 'password')).toBe(true);
    });

    it('accepts email with subdomain', async () => {
      const errors = rejectedFields(LoginBody, { ...validInput, email: 'user@mail.example.co.uk' });
      expect(errors).toHaveLength(0);
    });

    it('rejects empty string email', async () => {
      const errors = rejectedFields(LoginBody, { ...validInput, email: '' });
      expect(errors.some(field => field === 'email')).toBe(true);
    });
  });

  describe('RegisterBody', () => {
    const validInput = {
      email: 'newuser@example.com',
      password: 'securePassword123',
      name: 'John Doe',
    };

    it('passes validation with minimal required fields', async () => {
      const errors = rejectedFields(RegisterBody, validInput);
      expect(errors).toHaveLength(0);
    });

    it('passes validation with all optional fields', async () => {
      const errors = rejectedFields(RegisterBody, {
        ...validInput,
        company: 'Acme Corp',
        invitationToken: 'invite-token-abc',
      });
      expect(errors).toHaveLength(0);
    });

    it('fails validation for invalid email format', async () => {
      const errors = rejectedFields(RegisterBody, { ...validInput, email: 'bad@' });
      expect(errors.some(field => field === 'email')).toBe(true);
    });

    it('fails validation for password shorter than 8 characters', async () => {
      const errors = rejectedFields(RegisterBody, { ...validInput, password: 'short' });
      expect(errors.some(field => field === 'password')).toBe(true);
    });

    it('passes validation for password exactly 8 characters', async () => {
      const errors = rejectedFields(RegisterBody, { ...validInput, password: 'exactly8' });
      expect(errors.filter(field => field === 'password')).toHaveLength(0);
    });

    it('fails validation for missing name', async () => {
      const errors = rejectedFields(RegisterBody, { email: validInput.email, password: validInput.password });
      expect(errors.some(field => field === 'name')).toBe(true);
    });

    it('fails validation when name is not a string', async () => {
      const errors = rejectedFields(RegisterBody, { ...validInput, name: 42 });
      expect(errors.some(field => field === 'name')).toBe(true);
    });

    it('allows optional company to be absent', async () => {
      const errors = rejectedFields(RegisterBody, validInput);
      expect(errors).toHaveLength(0);
    });

    it('fails validation when company is not a string', async () => {
      const errors = rejectedFields(RegisterBody, { ...validInput, company: 123 });
      expect(errors.some(field => field === 'company')).toBe(true);
    });

    it('allows optional invitationToken to be absent', async () => {
      const errors = rejectedFields(RegisterBody, { ...validInput });
      expect(errors).toHaveLength(0);
    });
  });
});
