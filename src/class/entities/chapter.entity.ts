import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { AuditedBaseEntity } from '../../common/entities/audited-base.entity';
import { Class } from './class.entity';
import { Video } from './video.entity';
import { FileResource } from './file-resource.entity';

@Entity({ name: 'chapters' })
export class Chapter extends AuditedBaseEntity {
  @Column({ name: 'class_id' })
  class_id: string;

  @ManyToOne(() => Class, (cls) => cls.chapters)
  @JoinColumn({ name: 'class_id' })
  class_entity: Class;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'int', default: 0 })
  order: number;

  @OneToMany(() => Video, (video) => video.chapter)
  videos: Video[];

  @OneToMany(() => FileResource, (resource) => resource.chapter)
  resources: FileResource[];
}
