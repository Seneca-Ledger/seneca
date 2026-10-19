import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum ReportType {
  DAILY = 'daily',
  MONTHLY = 'monthly',
  CUSTOM = 'custom',
}

export enum ReportStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
}

@Entity('telegram_reports')
export class TelegramReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(
    () => User,
    user => user.telegramReports,
  )
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'chat_id' })
  chatId: string;

  @Column({
    name: 'report_type',
    type: 'enum',
    enum: ReportType,
  })
  reportType: ReportType;

  @Column({ name: 'report_date', type: 'date' })
  reportDate: Date;

  @Column({ type: 'timestamp', name: 'sent_at', nullable: true })
  sentAt: Date | null;

  @Column({
    type: 'enum',
    enum: ReportStatus,
    default: ReportStatus.PENDING,
  })
  status: ReportStatus;

  @Column({ type: 'varchar', name: 'message_id', nullable: true })
  messageId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
