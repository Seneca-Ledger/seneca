export interface ClassificationRule {
  id?: string;
  name: string;
  type: 'category' | 'branch' | 'wallet' | 'article' | 'activity_type';
  conditions: ClassificationCondition[];
  result: ClassificationResult;
  priority: number;
  isActive: boolean;
}

export interface ClassificationCondition {
  field:
    | 'counterparty_name'
    | 'payment_purpose'
    | 'amount'
    | 'counterparty_bin'
    | 'document_number'
    /**
     * Who the row belongs to, as a membership id or the literal `shared`.
     *
     * A freshly imported row has no owner until its wallet is known, which
     * happens after the rules run — so an owner condition matches when a rule
     * is re-applied to an existing row, not on the first pass of an import.
     */
    | 'owner'
    /** `income` or `expense`: amounts are stored unsigned, the direction says which. */
    | 'direction'
    | 'payment_type'
    /** The account (wallet) the row sits in, by id. */
    | 'wallet';
  operator:
    | 'contains'
    | 'equals'
    | 'starts_with'
    | 'ends_with'
    | 'regex'
    | 'greater_than'
    | 'less_than';
  value: string | number;
}

export interface ClassificationResult {
  categoryId?: string;
  branchId?: string;
  walletId?: string;
  article?: string;
  activityType?: string;
  /**
   * Hands the row to one member, or to the household with `null`. A rule saying
   * so beats inheriting the owner from the wallet: the user asked for it by name.
   */
  ownerMemberId?: string | null;
  /** Tags added to the row. Never a replacement: the tags it already has stay. */
  tagIds?: string[];
}
