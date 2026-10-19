## Description

<!-- Provide a clear and concise description of what this PR does -->

Fixes # (issue number)

## Type of Change

<!-- Mark the relevant option with an "x" -->

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Code refactoring
- [ ] Performance improvement
- [ ] Test update

## Changes Made

<!-- List the specific changes made in this PR -->

- 
- 
- 

## Screenshots (if applicable)

<!-- Add screenshots to help reviewers understand UI changes -->

## Testing

<!-- Describe the tests you ran to verify your changes -->

### Test Environment
- OS: 
- Node.js version: 
- Docker version (if applicable): 

### Tests Performed
- [ ] Unit tests pass (`npm test`)
- [ ] Linting passes (`npm --prefix backend run lint:check`, `npm --prefix frontend run lint:check`)
- [ ] Type checking passes (`npm --prefix backend run typecheck`, `npm --prefix frontend run type-check`)
- [ ] Manual testing performed
- [ ] E2E tests pass (if applicable)

### Test Scenarios
<!-- Describe specific scenarios you tested -->

1. 
2. 
3. 

## Checklist

<!-- Mark completed items with an "x" -->

- [ ] My code follows the project's style guidelines
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings or errors
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] Any dependent changes have been merged and published
- [ ] I have updated the CHANGELOG.md (if applicable)

## Database Changes

<!-- If this PR includes database changes, describe them here -->

- [ ] No database changes
- [ ] Migration included (describe):
- [ ] Seeds updated (if applicable)

## Security Impact

- [ ] No auth, session, CSRF or permission changes
- [ ] Every new query filters by `workspaceId`
- [ ] New cookie-authenticated write routes pass the CSRF check (or are `@SkipCsrf()` because they start a session)

## API Changes

<!-- If this PR changes the API, describe the changes -->

- [ ] No API changes
- [ ] Backward compatible API changes
- [ ] Breaking API changes (describe):

## Documentation

<!-- Check all that apply -->

- [ ] README.md updated
- [ ] API documentation updated (Swagger)
- [ ] Inline code comments added/updated
- [ ] Architecture documentation updated (if applicable)
- [ ] No documentation needed

## Dependencies

<!-- List any new dependencies added -->

- [ ] No new dependencies
- [ ] New dependencies added (list below):
  - 
  - 

## Breaking Changes

<!-- If this PR introduces breaking changes, describe them and the migration path -->

- [ ] No breaking changes
- [ ] Breaking changes (describe):

## Deployment Notes

<!-- Any special instructions for deploying this change? -->

- [ ] No special deployment steps
- [ ] Requires environment variable changes (list):
- [ ] Requires database migration
- [ ] Requires data seeding
- [ ] Other (describe):

## Related Issues/PRs

<!-- Link related issues and PRs -->

- Related to #
- Depends on #
- Blocks #

## Additional Notes

<!-- Any additional information reviewers should know -->

## Reviewer Guidelines

<!-- For reviewers: What should reviewers focus on? -->

Please pay special attention to:
- 
- 
- 

---

**By submitting this pull request, I confirm that my contribution is made under the terms of the project's MIT License.**
