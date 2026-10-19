# Import Error Classes

This module provides custom error classes for the import system with built-in error classification and retry logic.

## Error Classes

### ImportValidationError
- **Usage**: Invalid user input or data format
- **Retryable**: ❌ No
- **HTTP Status**: 400 Bad Request
- **Examples**:
  - Invalid file format
  - Missing required fields
  - Schema validation failures
  - Invalid configuration

```typescript
throw new ImportValidationError('Invalid file format', {
  format: 'unknown',
  expectedFormats: ['CSV', 'PDF', 'XLSX']
});
```

### ImportConflictError
- **Usage**: Operation conflicts with existing state
- **Retryable**: ❌ No (requires user decision)
- **HTTP Status**: 409 Conflict
- **Examples**:
  - Duplicate import session
  - Conflicting transaction matches
  - State transition not allowed
  - Resource already exists

```typescript
throw new ImportConflictError(
  'Import session already exists',
  'duplicate_session',
  { existingId: '123', fileHash: 'abc' }
);
```

### ImportTransientError
- **Usage**: Temporary failures that may succeed on retry
- **Retryable**: ✅ Yes
- **HTTP Status**: 503 Service Unavailable
- **Examples**:
  - Database deadlock or lock timeout
  - Network timeout
  - Temporary service unavailability
  - Rate limit exceeded (with backoff)
  - Transient parsing errors

```typescript
throw new ImportTransientError(
  'Database deadlock detected',
  originalError,
  30000 // retry after 30 seconds
);
```

### ImportFatalError
- **Usage**: Permanent failures that should not be retried
- **Retryable**: ❌ No
- **HTTP Status**: 500 Internal Server Error
- **Examples**:
  - File not found or corrupted
  - Permission denied (insufficient access rights)
  - Workspace or user not found
  - Critical database constraint violation
  - Unrecoverable parsing error

```typescript
throw new ImportFatalError(
  'File not found',
  originalError,
  { filePath: '/tmp/missing.csv' }
);
```

## Error Classification

The `classifyError()` function automatically converts unknown errors into appropriate import error types:

```typescript
import { classifyError, shouldRetry } from './import-errors';

try {
  await processImport();
} catch (error) {
  const classified = classifyError(error);
  console.log(`Error code: ${classified.code}`);
  console.log(`User message: ${classified.userMessage}`);

  // Convert to HTTP exception for API responses
  throw classified.toHttpException();
}
```

### Database Error Classification

PostgreSQL errors are automatically classified:

| PG Code | Error Type | Retryable | Description |
|---------|-----------|-----------|-------------|
| 40P01 | Transient | ✅ Yes | Deadlock detected |
| 55P03 | Transient | ✅ Yes | Lock timeout |
| 23505 | Conflict | ❌ No | Unique constraint violation |
| 23503 | Validation | ❌ No | Foreign key violation |
| 57P01, 08006, 08003 | Transient | ✅ Yes | Connection errors |
| Others | Fatal | ❌ No | Unknown database error |

### HTTP Exception Classification

| Status Code | Error Type | Retryable |
|------------|-----------|-----------|
| 400 Bad Request | Validation | ❌ No |
| 403 Forbidden | Fatal | ❌ No |
| 404 Not Found | Fatal | ❌ No |
| 409 Conflict | Conflict | ❌ No |
| 503 Service Unavailable | Transient | ✅ Yes |
| 504 Gateway Timeout | Transient | ✅ Yes |

## Best Practices

1. **Always use specific error types**: Don't use generic `Error` - use the appropriate import error class
2. **Provide context**: Include details object with relevant information for debugging
3. **User-friendly messages**: Error messages are shown to users, so make them helpful
4. **Classify unknown errors**: Use `classifyError()` when catching errors from external libraries
5. **Log appropriately**: Use different log levels based on error severity
   - Transient errors: `logger.warn()` (temporary issue)
   - Validation/Conflict errors: `logger.debug()` (user error)
   - Fatal errors: `logger.error()` (system issue)
