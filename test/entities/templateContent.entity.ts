import { Column, Entity, JoinColumn, ManyToOne, ObjectLiteral, OneToMany } from 'typeorm';

import { set } from '../utils/entities';
import { GenericEntity } from '../entities/generic';

import { TemplateConfigEntity } from './templateConfig.entity';
import { TemplateContentConfigInterface } from 'interfaces/entities';

@Entity({ name: 'template_content' })
export class TemplateContentEntity extends GenericEntity {
    @Column({})
    name: string;

    @Column(set({ type: 'jsonb', default: {} }))
    config: TemplateContentConfigInterface;

    @Column(set({ type: 'jsonb', default: {} }))
    options: ObjectLiteral;

    @Column({ type: 'text', default: '' })
    content: string;

    @Column({ name: 'template_config_id' })
    templateConfigId?: number;

    @Column({ name: 'template_content_id', default: null })
    templateContentId?: number;

    @ManyToOne(() => TemplateConfigEntity, (templateConfig) => templateConfig.templateContents)
    @JoinColumn({ name: 'template_config_id' })
    templateConfig?: TemplateConfigEntity;

    // parent
    @ManyToOne(() => TemplateContentEntity, (templateContent) => templateContent.templateContents)
    @JoinColumn({ name: 'template_content_id' })
    templateContent?: TemplateContentEntity;

    // children
    @OneToMany(() => TemplateContentEntity, (templateContent) => templateContent.templateContent)
    templateContents?: TemplateContentEntity[];
}
