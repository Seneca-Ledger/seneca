import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Workspace } from './workspace.entity';

/**
 * Who the workspace is, as a business: the "from" side of every document it
 * issues.
 *
 * An invoice without the issuer's legal name, address and a way to pay it is
 * not a document any jurisdiction recognises, and the client has nowhere to
 * send the money. It lives in its own table rather than on `workspaces`
 * because it is a dozen fields only the documents need, and because
 * e-invoicing (ЭСФ, Peppol, XRechnung) will need the same identity later.
 */
@Entity('workspace_business_profiles')
export class WorkspaceBusinessProfile {
  @PrimaryColumn({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  /** The name the business trades under on its documents. */
  @Column({ name: 'legal_name', type: 'varchar', length: 255, nullable: true })
  legalName: string | null;

  /** Company or sole-trader number: БИН/ИИН, company no., SIRET. */
  @Column({ name: 'registration_id', type: 'varchar', length: 64, nullable: true })
  registrationId: string | null;

  /** VAT/НДС registration number, when the business has one. */
  @Column({ name: 'tax_id', type: 'varchar', length: 64, nullable: true })
  taxId: string | null;

  /** Free-form, one line per line: street, city, postcode. */
  @Column({ name: 'address_lines', type: 'text', nullable: true })
  addressLines: string | null;

  @Column({ name: 'country_code', type: 'varchar', length: 2, nullable: true })
  countryCode: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  website: string | null;

  @Column({ name: 'bank_name', type: 'varchar', length: 255, nullable: true })
  bankName: string | null;

  /** IBAN, or the local account number. */
  @Column({ name: 'bank_account', type: 'varchar', length: 64, nullable: true })
  bankAccount: string | null;

  /** BIC/SWIFT, or the local bank code (БИК). */
  @Column({ name: 'bank_code', type: 'varchar', length: 32, nullable: true })
  bankCode: string | null;

  /** Anything the bank line does not cover: "pay by card at…", a payment link. */
  @Column({ name: 'payment_instructions', type: 'text', nullable: true })
  paymentInstructions: string | null;

  /** Default footer: terms, late-payment wording, thank-you note. */
  @Column({ name: 'invoice_footer', type: 'text', nullable: true })
  invoiceFooter: string | null;

  /** File name under `uploads/workspace-logos`, not a URL. */
  @Column({ name: 'logo_file', type: 'varchar', length: 255, nullable: true })
  logoFile: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
