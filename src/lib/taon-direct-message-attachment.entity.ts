import {
  Column,
  CreateDateColumn,
  Index,
  PrimaryGeneratedColumn,
  TaonBaseEntity,
  TaonEntity,
} from 'taon/src';

@TaonEntity({
  className: 'TaonDirectMessageAttachmentEntity',
  createTable: true,
})
export class TaonDirectMessageAttachmentEntity extends TaonBaseEntity<TaonDirectMessageAttachmentEntity> {
  @PrimaryGeneratedColumn()
  id: number;

  //#region @websql
  @Index()
  @Column({ type: 'integer' })
  //#endregion
  messageId: number;

  //#region @websql
  @Column({ type: 'varchar', length: 500 })
  //#endregion
  storageKey: string;

  //#region @websql
  @Column({ type: 'varchar', length: 300 })
  //#endregion
  fileName: string;

  //#region @websql
  @Column({ type: 'varchar', length: 100, nullable: true })
  //#endregion
  mimeType: string | null;

  //#region @websql
  @Column({ type: 'integer', nullable: true })
  //#endregion
  sizeBytes: number | null;

  @CreateDateColumn()
  createdAt: Date;
}
