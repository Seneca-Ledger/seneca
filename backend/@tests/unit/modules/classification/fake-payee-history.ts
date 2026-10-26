/**
 * Stands in for the transaction repository the payee-history step queries.
 * Records the conditions it was asked for, so a test can assert the rule that
 * only confirmed rows teach, and answers with the rows it was given —
 * newest first, the way the real query orders them.
 */
export function fakePayeeHistory(newestFirst: Array<{ categoryId: string }> = []) {
  const state = { rows: newestFirst, conditions: [] as string[], queried: false };

  const repository = {
    createQueryBuilder() {
      state.queried = true;
      const builder = {
        select: () => builder,
        where: (condition: string) => {
          state.conditions.push(condition);
          return builder;
        },
        andWhere: (condition: string) => {
          state.conditions.push(condition);
          return builder;
        },
        orderBy: () => builder,
        addOrderBy: () => builder,
        take: () => builder,
        getMany: async () => state.rows,
      };
      return builder;
    },
  };

  return { repository, state };
}
